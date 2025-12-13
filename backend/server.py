from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ============= MODELS =============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: str  # Can be username or email
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MemberCreate(BaseModel):
    prenume: str
    nume: str
    nume_inlocuitor: Optional[str] = ""

class MemberUpdate(BaseModel):
    prenume: Optional[str] = None
    nume: Optional[str] = None
    nume_inlocuitor: Optional[str] = None

class MemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nr: int
    prenume: str
    nume: str
    nume_inlocuitor: str

class GuestCreate(BaseModel):
    prenume: str
    nume: str
    companie: str
    invitat_de: str
    taxa: float = 0

class GuestUpdate(BaseModel):
    prenume: Optional[str] = None
    nume: Optional[str] = None
    companie: Optional[str] = None
    invitat_de: Optional[str] = None
    taxa: Optional[float] = None

class GuestResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nr: int
    prenume: str
    nume: str
    companie: str
    invitat_de: str
    taxa: float
    data: str

class AttendanceUpdate(BaseModel):
    member_id: str
    prezent: bool
    taxa: float
    nume_inlocuitor: Optional[str] = ""

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    member_id: str
    prezent: bool
    taxa: float
    nume_inlocuitor: str
    data: str

class DailyAttendanceResponse(BaseModel):
    data: str
    membri: List[dict]
    invitati: List[GuestResponse]
    total_taxa_membri: float
    total_taxa_invitati: float

# ============= AUTH HELPERS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def create_default_admin():
    """Create default admin user if not exists"""
    existing = await db.users.find_one({"username": "admin"})
    if not existing:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@local",
            "name": "Administrator",
            "password": hash_password("admin123"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default admin user created (admin/admin123)")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizator negăsit")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirat")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalid")

# ============= AUTH ROUTES =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email-ul există deja")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    # Search by username or email
    user = await db.users.find_one(
        {"$or": [{"username": credentials.email}, {"email": credentials.email}]}, 
        {"_id": 0}
    )
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Utilizator sau parolă incorectă")
    
    token = create_token(user["id"], user.get("email", user.get("username", "")))
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user.get("email", user.get("username", "")), name=user["name"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(id=current_user["id"], email=current_user["email"], name=current_user["name"])

# ============= MEMBERS ROUTES =============

@api_router.get("/members", response_model=List[MemberResponse])
async def get_members(current_user: dict = Depends(get_current_user)):
    members = await db.members.find({}, {"_id": 0}).sort("nr", 1).to_list(1000)
    return [MemberResponse(**m) for m in members]

@api_router.post("/members", response_model=MemberResponse)
async def create_member(member: MemberCreate, current_user: dict = Depends(get_current_user)):
    # Get next number
    last_member = await db.members.find_one(sort=[("nr", -1)])
    next_nr = (last_member["nr"] + 1) if last_member else 1
    
    member_doc = {
        "id": str(uuid.uuid4()),
        "nr": next_nr,
        "prenume": member.prenume,
        "nume": member.nume,
        "nume_inlocuitor": member.nume_inlocuitor or ""
    }
    await db.members.insert_one(member_doc)
    return MemberResponse(**member_doc)

@api_router.put("/members/{member_id}", response_model=MemberResponse)
async def update_member(member_id: str, member: MemberUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in member.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nu există date de actualizat")
    
    result = await db.members.find_one_and_update(
        {"id": member_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Membru negăsit")
    
    return MemberResponse(
        id=result["id"],
        nr=result["nr"],
        prenume=result["prenume"],
        nume=result["nume"],
        nume_inlocuitor=result.get("nume_inlocuitor", "")
    )

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membru negăsit")
    return {"message": "Membru șters cu succes"}

# ============= GUESTS ROUTES =============

@api_router.get("/guests/{data}", response_model=List[GuestResponse])
async def get_guests(data: str, current_user: dict = Depends(get_current_user)):
    guests = await db.guests.find({"data": data}, {"_id": 0}).sort("nr", 1).to_list(1000)
    return [GuestResponse(**g) for g in guests]

@api_router.post("/guests", response_model=GuestResponse)
async def create_guest(guest: GuestCreate, data: str, current_user: dict = Depends(get_current_user)):
    # Get next number for this date
    last_guest = await db.guests.find_one({"data": data}, sort=[("nr", -1)])
    next_nr = (last_guest["nr"] + 1) if last_guest else 1
    
    guest_doc = {
        "id": str(uuid.uuid4()),
        "nr": next_nr,
        "prenume": guest.prenume,
        "nume": guest.nume,
        "companie": guest.companie,
        "invitat_de": guest.invitat_de,
        "taxa": guest.taxa,
        "data": data
    }
    await db.guests.insert_one(guest_doc)
    return GuestResponse(**guest_doc)

@api_router.put("/guests/{guest_id}", response_model=GuestResponse)
async def update_guest(guest_id: str, guest: GuestUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in guest.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nu există date de actualizat")
    
    result = await db.guests.find_one_and_update(
        {"id": guest_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Invitat negăsit")
    
    return GuestResponse(
        id=result["id"],
        nr=result["nr"],
        prenume=result["prenume"],
        nume=result["nume"],
        companie=result["companie"],
        invitat_de=result["invitat_de"],
        taxa=result["taxa"],
        data=result["data"]
    )

@api_router.delete("/guests/{guest_id}")
async def delete_guest(guest_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.guests.delete_one({"id": guest_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invitat negăsit")
    return {"message": "Invitat șters cu succes"}

# ============= ATTENDANCE ROUTES =============

@api_router.get("/attendance/{data}", response_model=DailyAttendanceResponse)
async def get_daily_attendance(data: str, current_user: dict = Depends(get_current_user)):
    # Get all members
    members = await db.members.find({}, {"_id": 0}).sort("nr", 1).to_list(1000)
    
    # Get attendance records for this date
    attendance_records = await db.attendance.find({"data": data}, {"_id": 0}).to_list(1000)
    attendance_map = {r["member_id"]: r for r in attendance_records}
    
    # Combine members with their attendance
    membri_with_attendance = []
    total_taxa_membri = 0
    for m in members:
        att = attendance_map.get(m["id"], {"prezent": False, "taxa": 0})
        membri_with_attendance.append({
            "id": m["id"],
            "nr": m["nr"],
            "prenume": m["prenume"],
            "nume": m["nume"],
            "nume_inlocuitor": m.get("nume_inlocuitor", ""),
            "prezent": att.get("prezent", False),
            "taxa": att.get("taxa", 0)
        })
        total_taxa_membri += att.get("taxa", 0)
    
    # Get guests for this date
    guests = await db.guests.find({"data": data}, {"_id": 0}).sort("nr", 1).to_list(1000)
    total_taxa_invitati = sum(g.get("taxa", 0) for g in guests)
    
    return DailyAttendanceResponse(
        data=data,
        membri=membri_with_attendance,
        invitati=[GuestResponse(**g) for g in guests],
        total_taxa_membri=total_taxa_membri,
        total_taxa_invitati=total_taxa_invitati
    )

@api_router.post("/attendance/{data}")
async def update_attendance(data: str, attendance: AttendanceUpdate, current_user: dict = Depends(get_current_user)):
    # Upsert attendance record
    await db.attendance.update_one(
        {"member_id": attendance.member_id, "data": data},
        {"$set": {
            "member_id": attendance.member_id,
            "prezent": attendance.prezent,
            "taxa": attendance.taxa,
            "nume_inlocuitor": attendance.nume_inlocuitor or "",
            "data": data
        }},
        upsert=True
    )
    return {"message": "Prezență actualizată"}

@api_router.get("/attendance/dates/list")
async def get_attendance_dates(current_user: dict = Depends(get_current_user)):
    # Get unique dates from attendance and guests
    attendance_dates = await db.attendance.distinct("data")
    guest_dates = await db.guests.distinct("data")
    all_dates = list(set(attendance_dates + guest_dates))
    all_dates.sort(reverse=True)
    return {"dates": all_dates}

# ============= ROOT =============

@api_router.get("/")
async def root():
    return {"message": "API Membri și Invitați"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await create_default_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
