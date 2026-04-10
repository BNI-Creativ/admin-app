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
from datetime import datetime, timezone, date, timedelta
import io
import csv
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
    activ: bool = True
    data_msp: Optional[str] = None
    doreste_prezentare: bool = False
    nume_inlocuitor: Optional[str] = ""
    telefon: Optional[str] = ""
    email: Optional[str] = ""
    companie: Optional[str] = ""
    domeniu: Optional[str] = ""
    website: Optional[str] = ""
    instagram: Optional[str] = ""
    tiktok: Optional[str] = ""
    strada: Optional[str] = ""
    oras: Optional[str] = ""
    judet: Optional[str] = ""
    cod_postal: Optional[str] = ""
    tara: Optional[str] = ""

class MemberUpdate(BaseModel):
    prenume: Optional[str] = None
    nume: Optional[str] = None
    activ: Optional[bool] = None
    data_msp: Optional[str] = None
    doreste_prezentare: Optional[bool] = None
    nume_inlocuitor: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    companie: Optional[str] = None
    domeniu: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    tiktok: Optional[str] = None
    strada: Optional[str] = None
    oras: Optional[str] = None
    judet: Optional[str] = None
    cod_postal: Optional[str] = None
    tara: Optional[str] = None

class MemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nr: int
    prenume: str
    nume: str
    activ: bool = True
    data_msp: Optional[str] = None
    doreste_prezentare: bool = False
    nume_inlocuitor: str = ""
    telefon: str = ""
    email: str = ""
    companie: str = ""
    domeniu: str = ""
    website: str = ""
    instagram: str = ""
    tiktok: str = ""
    strada: str = ""
    oras: str = ""
    judet: str = ""
    cod_postal: str = ""
    tara: str = ""

class GuestCreate(BaseModel):
    prenume: str
    nume: str
    companie: str = ""
    telefon: str = ""
    invitat_de: str = ""
    taxa: float = 0
    prezent: bool = False
    is_inlocuitor: bool = False
    member_id: Optional[str] = None

class GuestUpdate(BaseModel):
    prenume: Optional[str] = None
    nume: Optional[str] = None
    companie: Optional[str] = None
    telefon: Optional[str] = None
    invitat_de: Optional[str] = None
    taxa: Optional[float] = None
    prezent: Optional[bool] = None
    is_inlocuitor: Optional[bool] = None
    member_id: Optional[str] = None

class GuestResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nr: int
    prenume: str
    nume: str
    companie: str
    telefon: str = ""
    invitat_de: str
    taxa: float
    data: str
    prezent: bool = False
    is_inlocuitor: bool = False
    member_id: Optional[str] = None

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

class EmailSettings(BaseModel):
    emails: List[str] = []

class SendPdfRequest(BaseModel):
    data: str
    pdf_base64: str

# Treasury models
class TreasuryEntryCreate(BaseModel):
    suma: float
    data: str
    explicatii: str = ""

class TreasuryEntryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    suma: float
    data: str
    explicatii: str
    created_at: str

# Monthly deduction model
class MonthlyDeductionUpdate(BaseModel):
    suma: float

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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    # Verify current password
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not user or not verify_password(request.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Parola curentă este incorectă")
    
    # Update password
    new_hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": new_hashed}}
    )
    return {"message": "Parola a fost schimbată cu succes"}

# ============= MEMBERS ROUTES =============

@api_router.get("/members", response_model=List[MemberResponse])
async def get_members(current_user: dict = Depends(get_current_user)):
    members = await db.members.find({}, {"_id": 0}).sort([("prenume", 1), ("nume", 1)]).to_list(1000)
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
        "activ": member.activ,
        "data_msp": member.data_msp,
        "doreste_prezentare": member.doreste_prezentare,
        "nume_inlocuitor": member.nume_inlocuitor or "",
        "telefon": member.telefon or "",
        "email": member.email or "",
        "companie": member.companie or "",
        "domeniu": member.domeniu or "",
        "website": member.website or "",
        "instagram": member.instagram or "",
        "tiktok": member.tiktok or "",
        "strada": member.strada or "",
        "oras": member.oras or "",
        "judet": member.judet or "",
        "cod_postal": member.cod_postal or "",
        "tara": member.tara or ""
    }
    await db.members.insert_one(member_doc)
    return MemberResponse(**member_doc)

@api_router.put("/members/{member_id}", response_model=MemberResponse)
async def update_member(member_id: str, member: MemberUpdate, current_user: dict = Depends(get_current_user)):
    # Use exclude_unset to properly handle False values (like activ=False)
    update_data = member.model_dump(exclude_unset=True)
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
        activ=result.get("activ", True),
        data_msp=result.get("data_msp"),
        doreste_prezentare=result.get("doreste_prezentare", False),
        nume_inlocuitor=result.get("nume_inlocuitor", ""),
        telefon=result.get("telefon", ""),
        email=result.get("email", ""),
        companie=result.get("companie", ""),
        domeniu=result.get("domeniu", ""),
        website=result.get("website", ""),
        instagram=result.get("instagram", ""),
        tiktok=result.get("tiktok", ""),
        strada=result.get("strada", ""),
        oras=result.get("oras", ""),
        judet=result.get("judet", ""),
        cod_postal=result.get("cod_postal", ""),
        tara=result.get("tara", "")
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
    # Ensure default values for is_inlocuitor, member_id, prezent, and telefon
    for g in guests:
        if "is_inlocuitor" not in g:
            g["is_inlocuitor"] = False
        if "member_id" not in g:
            g["member_id"] = None
        if "prezent" not in g:
            g["prezent"] = False
        if "telefon" not in g:
            g["telefon"] = ""
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
        "telefon": guest.telefon,
        "invitat_de": guest.invitat_de,
        "taxa": guest.taxa,
        "data": data,
        "prezent": guest.prezent,
        "is_inlocuitor": guest.is_inlocuitor,
        "member_id": guest.member_id
    }
    await db.guests.insert_one(guest_doc)
    return GuestResponse(**guest_doc)

@api_router.put("/guests/{guest_id}", response_model=GuestResponse)
async def update_guest(guest_id: str, guest: GuestUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in guest.model_dump().items() if v is not None}
    
    # Handle boolean fields that could be explicitly set to False
    if guest.prezent is not None:
        update_data["prezent"] = guest.prezent
    if guest.is_inlocuitor is not None:
        update_data["is_inlocuitor"] = guest.is_inlocuitor
    # Handle invitat_de being set to empty string
    if guest.invitat_de is not None:
        update_data["invitat_de"] = guest.invitat_de
    if guest.member_id is not None:
        update_data["member_id"] = guest.member_id
    
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
        companie=result.get("companie", ""),
        telefon=result.get("telefon", ""),
        invitat_de=result.get("invitat_de", ""),
        taxa=result.get("taxa", 0),
        data=result["data"],
        prezent=result.get("prezent", False),
        is_inlocuitor=result.get("is_inlocuitor", False),
        member_id=result.get("member_id")
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
    # Get all ACTIVE members sorted by prenume, then nume
    members = await db.members.find({"activ": {"$ne": False}}, {"_id": 0}).sort([("prenume", 1), ("nume", 1)]).to_list(1000)
    
    # Get attendance records for this date
    attendance_records = await db.attendance.find({"data": data}, {"_id": 0}).to_list(1000)
    attendance_map = {r["member_id"]: r for r in attendance_records}
    
    # Calculate monthly totals for each member
    # Extract year and month from the date
    year_month = data[:7]  # "2025-12" format
    start_date = f"{year_month}-01"
    end_date = f"{year_month}-31"
    
    # Get all attendance records for the current month
    monthly_records = await db.attendance.find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Calculate monthly totals per member
    monthly_totals = {}
    for record in monthly_records:
        member_id = record.get("member_id")
        taxa = record.get("taxa", 0)
        if member_id not in monthly_totals:
            monthly_totals[member_id] = 0
        monthly_totals[member_id] += taxa
    
    # Calculate cumulative balance from previous months (starting April 2026)
    # sold_pivotat = sum of (taxa_lunara_membru - taxa_lunara_globala) for all months from April 2026 to previous month
    sold_pivotat = {}
    current_date = datetime.strptime(data, "%Y-%m-%d")
    start_pivot_date = datetime(2026, 4, 1)
    
    if current_date >= start_pivot_date:
        # Get all monthly deductions from April 2026 to previous month
        pivot_month = datetime(2026, 4, 1)
        while pivot_month < datetime(current_date.year, current_date.month, 1):
            month_key = pivot_month.strftime("%Y-%m")
            month_start = f"{month_key}-01"
            month_end = f"{month_key}-31"
            
            # Get monthly deduction for this month
            deduction_doc = await db.monthly_deductions.find_one({"key": month_key}, {"_id": 0})
            monthly_deduction = deduction_doc.get("suma", 0) if deduction_doc else 0
            
            # Get all attendance records for this month
            month_attendance = await db.attendance.find({
                "data": {"$gte": month_start, "$lte": month_end}
            }, {"_id": 0}).to_list(10000)
            
            # Calculate each member's monthly total
            month_member_totals = {}
            for record in month_attendance:
                member_id = record.get("member_id")
                taxa = record.get("taxa", 0)
                if member_id not in month_member_totals:
                    month_member_totals[member_id] = 0
                month_member_totals[member_id] += taxa
            
            # Add to cumulative balance for each member
            for m in members:
                member_id = m["id"]
                member_taxa = month_member_totals.get(member_id, 0)
                balance = member_taxa - monthly_deduction
                if member_id not in sold_pivotat:
                    sold_pivotat[member_id] = 0
                sold_pivotat[member_id] += balance
            
            # Move to next month
            if pivot_month.month == 12:
                pivot_month = datetime(pivot_month.year + 1, 1, 1)
            else:
                pivot_month = datetime(pivot_month.year, pivot_month.month + 1, 1)
    
    # Combine members with their attendance
    membri_with_attendance = []
    total_taxa_membri = 0
    for m in members:
        att = attendance_map.get(m["id"], {"prezent": False, "taxa": 0, "nume_inlocuitor": ""})
        # Use attendance nume_inlocuitor if exists, otherwise empty
        nume_inlocuitor = att.get("nume_inlocuitor", "")
        membri_with_attendance.append({
            "id": m["id"],
            "nr": m["nr"],
            "prenume": m["prenume"],
            "nume": m["nume"],
            "nume_inlocuitor": nume_inlocuitor,
            "prezent": att.get("prezent", False),
            "taxa": att.get("taxa", 0),
            "taxa_lunara": monthly_totals.get(m["id"], 0),
            "sold_pivotat": sold_pivotat.get(m["id"], 0)
        })
        total_taxa_membri += att.get("taxa", 0)
    
    # Get guests for this date
    guests = await db.guests.find({"data": data}, {"_id": 0}).sort("nr", 1).to_list(1000)
    # Ensure default values
    for g in guests:
        if "is_inlocuitor" not in g:
            g["is_inlocuitor"] = False
        if "member_id" not in g:
            g["member_id"] = None
        if "prezent" not in g:
            g["prezent"] = False
        if "telefon" not in g:
            g["telefon"] = ""
    total_taxa_invitati = sum(g.get("taxa", 0) for g in guests)
    
    return DailyAttendanceResponse(
        data=data,
        membri=membri_with_attendance,
        invitati=[GuestResponse(**g) for g in guests],
        total_taxa_membri=total_taxa_membri,
        total_taxa_invitati=total_taxa_invitati
    )

# Public endpoint for projector page (no auth required)
@api_router.get("/proiector/{data}")
async def get_projector_data(data: str):
    """Get present members and guests for projector display - public endpoint"""
    # Get active members
    members = await db.members.find({"activ": {"$ne": False}}, {"_id": 0}).sort([("prenume", 1), ("nume", 1)]).to_list(1000)
    
    # Get attendance for this date
    attendance_records = await db.attendance.find({"data": data}, {"_id": 0}).to_list(1000)
    attendance_map = {a["member_id"]: a for a in attendance_records}
    
    # Get guests for this date
    guests = await db.guests.find({"data": data}, {"_id": 0}).to_list(1000)
    
    # Collect present people
    prezenti = []
    
    # Add present members
    for m in members:
        att = attendance_map.get(m["id"], {})
        if att.get("prezent", False):
            prezenti.append({
                "prenume": m["prenume"],
                "nume": m["nume"],
                "tip": "Membru"
            })
    
    # Add present guests
    for g in guests:
        if g.get("prezent", False):
            prezenti.append({
                "prenume": g["prenume"],
                "nume": g["nume"],
                "tip": "Invitat",
                "companie": g.get("companie", ""),
                "invitat_de": g.get("invitat_de", "")
            })
    
    # Sort alphabetically
    prezenti.sort(key=lambda x: f"{x['prenume']} {x['nume']}".lower())
    
    return {
        "data": data,
        "prezenti": prezenti,
        "total": len(prezenti)
    }

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

# ============= SYNC ENDPOINTS =============

class SyncPushData(BaseModel):
    members: List[dict] = []
    attendance: List[dict] = []
    guests: List[dict] = []

@api_router.post("/sync/push")
async def sync_push(data: SyncPushData):
    """
    Receive data from mobile app (local priority - overwrites server data)
    """
    results = {"members": 0, "attendance": 0, "guests": 0}
    
    # Sync members
    for member in data.members:
        member_id = member.get("id")
        if member_id:
            await db.members.update_one(
                {"id": member_id},
                {"$set": {
                    "id": member_id,
                    "nr": member.get("nr", 0),
                    "prenume": member.get("prenume", ""),
                    "nume": member.get("nume", ""),
                    "created_at": member.get("created_at"),
                    "updated_at": member.get("updated_at")
                }},
                upsert=True
            )
            results["members"] += 1
    
    # Sync attendance
    for att in data.attendance:
        member_id = att.get("member_id")
        data_str = att.get("data")
        if member_id and data_str:
            await db.attendance.update_one(
                {"member_id": member_id, "data": data_str},
                {"$set": {
                    "member_id": member_id,
                    "data": data_str,
                    "prezent": att.get("prezent", False),
                    "taxa": att.get("taxa", 0),
                    "nume_inlocuitor": att.get("nume_inlocuitor", ""),
                    "created_at": att.get("created_at"),
                    "updated_at": att.get("updated_at")
                }},
                upsert=True
            )
            results["attendance"] += 1
    
    # Sync guests
    for guest in data.guests:
        guest_id = guest.get("id")
        if guest_id:
            await db.guests.update_one(
                {"id": guest_id},
                {"$set": {
                    "id": guest_id,
                    "nr": guest.get("nr", 0),
                    "prenume": guest.get("prenume", ""),
                    "nume": guest.get("nume", ""),
                    "companie": guest.get("companie", ""),
                    "invitat_de": guest.get("invitat_de", ""),
                    "taxa": guest.get("taxa", 0),
                    "data": guest.get("data", ""),
                    "is_inlocuitor": guest.get("is_inlocuitor", False),
                    "member_id": guest.get("member_id"),
                    "created_at": guest.get("created_at"),
                    "updated_at": guest.get("updated_at")
                }},
                upsert=True
            )
            results["guests"] += 1
    
    return {"success": True, "synced": results}

@api_router.get("/sync/pull")
async def sync_pull(since: Optional[str] = None):
    """
    Send all data to mobile app (or only data updated since last sync)
    """
    query = {}
    if since:
        # Filter by updated_at if since is provided
        query["updated_at"] = {"$gt": since}
    
    # Get all members
    members = await db.members.find({}, {"_id": 0}).to_list(10000)
    
    # Get attendance (optionally filtered by date)
    attendance = await db.attendance.find({}, {"_id": 0}).to_list(100000)
    
    # Get guests (optionally filtered by date)
    guests = await db.guests.find({}, {"_id": 0}).to_list(100000)
    
    return {
        "members": members,
        "attendance": attendance,
        "guests": guests,
        "server_time": datetime.now(timezone.utc).isoformat()
    }

# ============= EXPORT/IMPORT ENDPOINTS =============

EXPORT_VERSION = "1.0"

class ImportData(BaseModel):
    version: str = "1.0"
    members: List[dict] = []
    attendance: List[dict] = []
    guests: List[dict] = []

@api_router.get("/export")
async def export_all_data(current_user: dict = Depends(get_current_user)):
    """
    Export all data from the database as JSON.
    Includes version for future compatibility.
    """
    # Get all members
    members = await db.members.find({}, {"_id": 0}).to_list(100000)
    
    # Get all attendance records
    attendance = await db.attendance.find({}, {"_id": 0}).to_list(100000)
    
    # Get all guests
    guests = await db.guests.find({}, {"_id": 0}).to_list(100000)
    
    export_data = {
        "version": EXPORT_VERSION,
        "export_date": datetime.now(timezone.utc).isoformat(),
        "app_name": "BNI Prezenta",
        "data": {
            "members": members,
            "attendance": attendance,
            "guests": guests
        },
        "counts": {
            "members": len(members),
            "attendance": len(attendance),
            "guests": len(guests)
        }
    }
    
    return export_data

@api_router.post("/import")
async def import_all_data(import_data: dict, current_user: dict = Depends(get_current_user)):
    """
    Import data into the database from JSON export.
    REPLACES all existing data (does not merge).
    Supports version migration for future compatibility.
    """
    version = import_data.get("version", "1.0")
    data = import_data.get("data", import_data)  # Support both nested and flat structure
    
    # Handle different versions
    if version.startswith("1."):
        # Version 1.x - current format
        members = data.get("members", [])
        attendance = data.get("attendance", [])
        guests = data.get("guests", [])
    else:
        # Unknown version - try to import anyway
        members = data.get("members", [])
        attendance = data.get("attendance", [])
        guests = data.get("guests", [])
    
    # First, delete ALL existing data
    deleted = {
        "members": (await db.members.delete_many({})).deleted_count,
        "attendance": (await db.attendance.delete_many({})).deleted_count,
        "guests": (await db.guests.delete_many({})).deleted_count
    }
    logger.info(f"Deleted existing data: {deleted}")
    
    results = {
        "members": {"imported": 0, "errors": 0},
        "attendance": {"imported": 0, "errors": 0},
        "guests": {"imported": 0, "errors": 0}
    }
    
    # Import members
    for member in members:
        try:
            member_id = member.get("id")
            if not member_id:
                member_id = str(uuid.uuid4())
            
            member_doc = {
                "id": member_id,
                "nr": member.get("nr", 0),
                "prenume": member.get("prenume", ""),
                "nume": member.get("nume", ""),
                "nume_inlocuitor": member.get("nume_inlocuitor", ""),
                "created_at": member.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.members.insert_one(member_doc)
            results["members"]["imported"] += 1
        except Exception as e:
            logger.error(f"Error importing member: {e}")
            results["members"]["errors"] += 1
    
    # Import attendance
    for att in attendance:
        try:
            member_id = att.get("member_id")
            data_str = att.get("data")
            
            if not member_id or not data_str:
                continue
            
            att_doc = {
                "member_id": member_id,
                "data": data_str,
                "prezent": att.get("prezent", False),
                "taxa": att.get("taxa", 0),
                "nume_inlocuitor": att.get("nume_inlocuitor", ""),
                "created_at": att.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.attendance.insert_one(att_doc)
            results["attendance"]["imported"] += 1
        except Exception as e:
            logger.error(f"Error importing attendance: {e}")
            results["attendance"]["errors"] += 1
    
    # Import guests
    for guest in guests:
        try:
            guest_id = guest.get("id")
            if not guest_id:
                guest_id = str(uuid.uuid4())
            
            guest_doc = {
                "id": guest_id,
                "nr": guest.get("nr", 0),
                "prenume": guest.get("prenume", ""),
                "nume": guest.get("nume", ""),
                "companie": guest.get("companie", ""),
                "invitat_de": guest.get("invitat_de", ""),
                "taxa": guest.get("taxa", 0),
                "data": guest.get("data", ""),
                "prezent": guest.get("prezent", False),
                "is_inlocuitor": guest.get("is_inlocuitor", False),
                "member_id": guest.get("member_id"),
                "created_at": guest.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.guests.insert_one(guest_doc)
            results["guests"]["imported"] += 1
        except Exception as e:
            logger.error(f"Error importing guest: {e}")
            results["guests"]["errors"] += 1
    
    return {
        "success": True,
        "version_imported": version,
        "deleted": deleted,
        "results": results
    }

@api_router.delete("/clear-all")
async def clear_all_data(current_user: dict = Depends(get_current_user)):
    """
    Clear all data from database (members, attendance, guests).
    Use with caution - this cannot be undone!
    """
    # Delete all data
    members_result = await db.members.delete_many({})
    attendance_result = await db.attendance.delete_many({})
    guests_result = await db.guests.delete_many({})
    
    return {
        "success": True,
        "deleted": {
            "members": members_result.deleted_count,
            "attendance": attendance_result.deleted_count,
            "guests": guests_result.deleted_count
        }
    }

# ============= EMAIL SETTINGS =============

@api_router.get("/settings/emails")
async def get_email_settings(current_user: dict = Depends(get_current_user)):
    """Get stored email addresses"""
    settings = await db.settings.find_one({"type": "emails"}, {"_id": 0})
    if settings:
        return {"emails": settings.get("emails", [])}
    return {"emails": []}

@api_router.post("/settings/emails")
async def save_email_settings(data: EmailSettings, current_user: dict = Depends(get_current_user)):
    """Save email addresses"""
    await db.settings.update_one(
        {"type": "emails"},
        {"$set": {"type": "emails", "emails": data.emails}},
        upsert=True
    )
    return {"success": True, "emails": data.emails}

class MspValidityUpdate(BaseModel):
    zile: int

@api_router.get("/settings/msp-validity")
async def get_msp_validity(current_user: dict = Depends(get_current_user)):
    """Get MSP validity days setting"""
    doc = await db.settings.find_one({"type": "msp_validity"}, {"_id": 0})
    return {"zile": doc.get("zile", 365) if doc else 365}

@api_router.post("/settings/msp-validity")
async def set_msp_validity(data: MspValidityUpdate, current_user: dict = Depends(get_current_user)):
    """Set MSP validity days setting"""
    await db.settings.update_one(
        {"type": "msp_validity"},
        {"$set": {"type": "msp_validity", "zile": data.zile}},
        upsert=True
    )
    return {"success": True, "zile": data.zile}

@api_router.post("/send-pdf-email")
async def send_pdf_email(request: SendPdfRequest, current_user: dict = Depends(get_current_user)):
    """Send PDF via email to stored addresses"""
    import base64
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email.mime.text import MIMEText
    from email import encoders
    
    # Get stored emails
    settings = await db.settings.find_one({"type": "emails"}, {"_id": 0})
    if not settings or not settings.get("emails"):
        raise HTTPException(status_code=400, detail="Nu există email-uri configurate")
    
    emails = settings["emails"]
    
    try:
        # Decode PDF from base64
        pdf_data = base64.b64decode(request.pdf_base64)
        
        # Get SMTP settings from environment or use defaults
        smtp_host = os.environ.get('SMTP_HOST', 'localhost')
        smtp_port = int(os.environ.get('SMTP_PORT', '25'))
        smtp_user = os.environ.get('SMTP_USER', '')
        smtp_pass = os.environ.get('SMTP_PASS', '')
        smtp_from = os.environ.get('SMTP_FROM', 'prezenta@local')
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_from
        msg['To'] = ', '.join(emails)
        msg['Subject'] = f'Prezență - {request.data}'
        
        # Email body
        body = f'Atașat găsiți raportul de prezență pentru data de {request.data}.'
        msg.attach(MIMEText(body, 'plain'))
        
        # Attach PDF
        attachment = MIMEBase('application', 'pdf')
        attachment.set_payload(pdf_data)
        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', f'attachment; filename="prezenta_{request.data}.pdf"')
        msg.attach(attachment)
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if smtp_user and smtp_pass:
                server.starttls()
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        
        logger.info(f"PDF sent to: {emails}")
        return {"success": True, "sent_to": emails}
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=f"Eroare la trimiterea email-ului: {str(e)}")

# ============= TREASURY ROUTES =============

@api_router.get("/treasury", response_model=List[TreasuryEntryResponse])
async def get_treasury_entries(current_user: dict = Depends(get_current_user)):
    """Get all treasury entries sorted by date descending (most recent first)"""
    entries = await db.treasury.find({}, {"_id": 0}).sort("data", -1).to_list(10000)
    return [TreasuryEntryResponse(**e) for e in entries]

@api_router.get("/treasury/total")
async def get_treasury_total(current_user: dict = Depends(get_current_user)):
    """Get total sum of all treasury entries"""
    entries = await db.treasury.find({}, {"_id": 0, "suma": 1}).to_list(10000)
    total = sum(e.get("suma", 0) for e in entries)
    return {"total": total}

@api_router.post("/treasury", response_model=TreasuryEntryResponse)
async def create_treasury_entry(entry: TreasuryEntryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new treasury entry"""
    entry_doc = {
        "id": str(uuid.uuid4()),
        "suma": entry.suma,
        "data": entry.data,
        "explicatii": entry.explicatii,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.treasury.insert_one(entry_doc)
    return TreasuryEntryResponse(**entry_doc)

@api_router.delete("/treasury/{entry_id}")
async def delete_treasury_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a treasury entry"""
    result = await db.treasury.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Intrare negăsită")
    return {"message": "Intrare ștearsă cu succes"}

# ============= MONTHLY DEDUCTION ROUTES =============

@api_router.get("/monthly-deduction/{year}/{month}")
async def get_monthly_deduction(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get the monthly deduction (X) for a specific month"""
    key = f"{year}-{month:02d}"
    doc = await db.monthly_deductions.find_one({"key": key}, {"_id": 0})
    if doc:
        return {"suma": doc.get("suma", 0)}
    return {"suma": 0}

@api_router.post("/monthly-deduction/{year}/{month}")
async def set_monthly_deduction(year: int, month: int, data: MonthlyDeductionUpdate, current_user: dict = Depends(get_current_user)):
    """Set the monthly deduction (X) for a specific month"""
    key = f"{year}-{month:02d}"
    await db.monthly_deductions.update_one(
        {"key": key},
        {"$set": {"key": key, "suma": data.suma}},
        upsert=True
    )
    return {"message": "Sumă actualizată", "suma": data.suma}

# ============= SPEAKERS ROUTES =============

class SpeakerCreate(BaseModel):
    prenume: str
    nume: str
    data: str  # YYYY-MM-DD
    member_id: Optional[str] = None

class SpeakerResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    prenume: str
    nume: str
    data: str
    member_id: Optional[str] = None
    created_at: str

@api_router.get("/speakers", response_model=List[SpeakerResponse])
async def get_speakers(current_user: dict = Depends(get_current_user)):
    """Get all past speakers sorted by date descending"""
    speakers = await db.speakers_history.find({}, {"_id": 0}).sort("data", -1).to_list(10000)
    return [SpeakerResponse(**s) for s in speakers]

@api_router.post("/speakers", response_model=SpeakerResponse)
async def add_speaker(speaker: SpeakerCreate, current_user: dict = Depends(get_current_user)):
    """Add a past speaker entry"""
    doc = {
        "id": str(uuid.uuid4()),
        "prenume": speaker.prenume,
        "nume": speaker.nume,
        "data": speaker.data,
        "member_id": speaker.member_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.speakers_history.insert_one(doc)
    return SpeakerResponse(**doc)

@api_router.delete("/speakers/{speaker_id}")
async def delete_speaker(speaker_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a speaker entry"""
    result = await db.speakers_history.delete_one({"id": speaker_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Înregistrare negăsită")
    return {"message": "Înregistrare ștearsă"}

@api_router.post("/speakers/schedule/{member_id}")
async def set_speaker_schedule(member_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Set the scheduled next presentation date and/or status checkbox for a speaker"""
    update_fields = {"member_id": member_id}
    if "next_date" in request:
        update_fields["next_date"] = request.get("next_date", "")
    if "checked" in request:
        update_fields["checked"] = bool(request.get("checked", False))
    await db.speaker_schedules.update_one(
        {"member_id": member_id},
        {"$set": update_fields},
        upsert=True
    )
    return {"success": True}

@api_router.get("/speakers/next")
async def get_next_speakers(current_user: dict = Depends(get_current_user)):
    """Get next 12 eligible speakers using Round-Robin algorithm"""
    today = date.today()

    # Get MSP validity days
    msp_doc = await db.settings.find_one({"type": "msp_validity"}, {"_id": 0})
    zile_msp = msp_doc.get("zile", 365) if msp_doc else 365

    # Get eligible members: activ, doreste_prezentare=True, MSP valid
    all_members = await db.members.find(
        {"activ": {"$ne": False}, "doreste_prezentare": True},
        {"_id": 0}
    ).sort([("prenume", 1), ("nume", 1)]).to_list(1000)

    eligible = []
    for m in all_members:
        data_msp = m.get("data_msp")
        if not data_msp:
            continue
        try:
            msp_date = datetime.strptime(data_msp, "%Y-%m-%d").date()
            if msp_date + timedelta(days=zile_msp) >= today:
                eligible.append(m)
        except Exception:
            continue

    if not eligible:
        return {"next_speakers": [], "eligible_count": 0}

    # Find last speaking date for each eligible member
    member_last_date = {}
    for m in eligible:
        last = await db.speakers_history.find_one(
            {"member_id": m["id"]},
            {"_id": 0, "data": 1},
            sort=[("data", -1)]
        )
        member_last_date[m["id"]] = last["data"] if last else None

    # Sort: never spoken first (alphabetically), then by last date ascending
    def sort_key(m):
        last = member_last_date.get(m["id"])
        if last is None:
            return ("0", m.get("prenume", ""), m.get("nume", ""))
        return ("1", last, "")

    sorted_eligible = sorted(eligible, key=sort_key)

    schedules = await db.speaker_schedules.find({}, {"_id": 0}).to_list(1000)
    schedule_map = {
        s["member_id"]: {"next_date": s.get("next_date", ""), "checked": s.get("checked", False)}
        for s in schedules
    }

    next_speakers = []
    count = 12
    for i in range(count):
        member = sorted_eligible[i % len(sorted_eligible)]
        sched = schedule_map.get(member["id"], {})
        next_speakers.append({
            "slot": i + 1,
            "member_id": member["id"],
            "prenume": member["prenume"],
            "nume": member["nume"],
            "last_date": member_last_date.get(member["id"]),
            "next_date": sched.get("next_date", ""),
            "checked": sched.get("checked", False)
        })

    return {"next_speakers": next_speakers, "eligible_count": len(eligible)}
@api_router.get("/speakers/export-csv")
async def export_speakers_csv(current_user: dict = Depends(get_current_user)):
    """Export all speakers as CSV"""
    from fastapi.responses import StreamingResponse
    speakers = await db.speakers_history.find({}, {"_id": 0}).sort("data", 1).to_list(10000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["data", "prenume", "nume", "member_id"])
    for s in speakers:
        writer.writerow([
            s.get("data", ""),
            s.get("prenume", ""),
            s.get("nume", ""),
            s.get("member_id", "")
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vorbitori.csv"}
    )

@api_router.post("/speakers/import-csv")
async def import_speakers_csv(request: dict, current_user: dict = Depends(get_current_user)):
    """Import speakers from CSV content (base64 or plain text)"""
    csv_content = request.get("csv_content", "")
    replace = request.get("replace", False)

    if replace:
        await db.speakers_history.delete_many({})

    reader = csv.DictReader(io.StringIO(csv_content))
    imported = 0
    errors = 0
    for row in reader:
        try:
            data_val = row.get("data", "").strip()
            prenume = row.get("prenume", "").strip()
            nume = row.get("nume", "").strip()
            if not data_val or not prenume or not nume:
                continue
            member_id = row.get("member_id", "").strip() or None
            doc = {
                "id": str(uuid.uuid4()),
                "prenume": prenume,
                "nume": nume,
                "data": data_val,
                "member_id": member_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.speakers_history.insert_one(doc)
            imported += 1
        except Exception:
            errors += 1

    return {"success": True, "imported": imported, "errors": errors}

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
