"""
Comprehensive Backend API Tests for BNI Prezenta App
Tests: Authentication, Members, Guests, Attendance, Export/Import
"""
import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_with_admin_credentials(self):
        """Test login with admin/admin123"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        data = response.json()
        
        assert "access_token" in data, "Missing access_token"
        assert "user" in data, "Missing user"
        assert data["user"]["name"] == "Administrator", f"Unexpected user name: {data['user']['name']}"
        
        print(f"✓ Login successful with admin/admin123")
        print(f"  - User: {data['user']['name']}")
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong credentials"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong",
            "password": "wrong"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected with 401")
    
    def test_get_me_with_valid_token(self):
        """Test /auth/me endpoint with valid token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        token = login_response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get me
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        print(f"✓ /auth/me returns user info correctly")


class TestMembers:
    """Members CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_members_list(self):
        """Test GET /api/members returns list"""
        response = self.session.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of members"
        print(f"✓ GET /api/members returns {len(data)} members")
    
    def test_create_member(self):
        """Test POST /api/members creates new member"""
        member_data = {
            "prenume": "TEST_Prenume",
            "nume": "TEST_Nume"
        }
        
        response = self.session.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["prenume"] == "TEST_Prenume"
        assert data["nume"] == "TEST_Nume"
        assert "id" in data
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/members/{data['id']}")
        print(f"✓ Member created successfully")
    
    def test_members_sorted_alphabetically(self):
        """Test members are sorted alphabetically by prenume, then nume"""
        response = self.session.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        if len(members) > 1:
            # Check sorting
            for i in range(len(members) - 1):
                name1 = f"{members[i]['prenume']} {members[i]['nume']}".lower()
                name2 = f"{members[i+1]['prenume']} {members[i+1]['nume']}".lower()
                assert name1 <= name2, f"Members not sorted: {name1} > {name2}"
        
        print(f"✓ Members are sorted alphabetically")


class TestGuests:
    """Guests CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        self.test_date = datetime.now().strftime("%Y-%m-%d")
    
    def test_create_guest(self):
        """Test POST /api/guests creates new guest"""
        guest_data = {
            "prenume": "TEST_Guest",
            "nume": "TEST_GuestNume",
            "companie": "Test Company",
            "invitat_de": "",
            "taxa": 25.0,
            "prezent": False,
            "is_inlocuitor": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/guests?data={self.test_date}", json=guest_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["prenume"] == "TEST_Guest"
        assert data["taxa"] == 25.0
        assert "id" in data
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/guests/{data['id']}")
        print(f"✓ Guest created successfully")
    
    def test_update_guest_prezent(self):
        """Test updating guest prezent status"""
        # Create guest first
        guest_data = {
            "prenume": "TEST_PrezentGuest",
            "nume": "TEST_Nume",
            "companie": "",
            "invitat_de": "",
            "taxa": 0,
            "prezent": False,
            "is_inlocuitor": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/guests?data={self.test_date}", json=guest_data)
        guest_id = create_response.json()["id"]
        
        # Update prezent
        update_response = self.session.put(f"{BASE_URL}/api/guests/{guest_id}", json={
            "prezent": True
        })
        assert update_response.status_code == 200
        
        updated_data = update_response.json()
        assert updated_data["prezent"] == True, "Prezent should be True"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/guests/{guest_id}")
        print(f"✓ Guest prezent status updated successfully")
    
    def test_update_guest_inlocuitor(self):
        """Test updating guest is_inlocuitor status"""
        # Create guest first
        guest_data = {
            "prenume": "TEST_InlocuitorGuest",
            "nume": "TEST_Nume",
            "companie": "",
            "invitat_de": "Test Member",
            "taxa": 0,
            "prezent": False,
            "is_inlocuitor": False,
            "member_id": "test-member-id"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/guests?data={self.test_date}", json=guest_data)
        guest_id = create_response.json()["id"]
        
        # Update is_inlocuitor
        update_response = self.session.put(f"{BASE_URL}/api/guests/{guest_id}", json={
            "is_inlocuitor": True
        })
        assert update_response.status_code == 200
        
        updated_data = update_response.json()
        assert updated_data["is_inlocuitor"] == True, "is_inlocuitor should be True"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/guests/{guest_id}")
        print(f"✓ Guest is_inlocuitor status updated successfully")


class TestAttendance:
    """Attendance tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        self.test_date = datetime.now().strftime("%Y-%m-%d")
    
    def test_get_daily_attendance(self):
        """Test GET /api/attendance/{date} returns daily data"""
        response = self.session.get(f"{BASE_URL}/api/attendance/{self.test_date}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "data" in data
        assert "membri" in data
        assert "invitati" in data
        assert "total_taxa_membri" in data
        assert "total_taxa_invitati" in data
        
        print(f"✓ Daily attendance returns correct structure")
        print(f"  - Members: {len(data['membri'])}")
        print(f"  - Guests: {len(data['invitati'])}")
    
    def test_attendance_dates_list(self):
        """Test GET /api/attendance/dates/list returns dates"""
        response = self.session.get(f"{BASE_URL}/api/attendance/dates/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "dates" in data
        assert isinstance(data["dates"], list)
        
        print(f"✓ Attendance dates list returns {len(data['dates'])} dates")
    
    def test_update_member_attendance(self):
        """Test POST /api/attendance/{date} updates attendance"""
        # First get a member
        members_response = self.session.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        if not members:
            pytest.skip("No members to test attendance")
        
        member_id = members[0]["id"]
        
        # Update attendance
        attendance_data = {
            "member_id": member_id,
            "prezent": True,
            "taxa": 50.0,
            "nume_inlocuitor": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/attendance/{self.test_date}", json=attendance_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        print(f"✓ Member attendance updated successfully")


class TestExportImport:
    """Export/Import tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_export_returns_json(self):
        """Test GET /api/export returns valid JSON"""
        response = self.session.get(f"{BASE_URL}/api/export")
        assert response.status_code == 200
        
        data = response.json()
        assert "version" in data
        assert "data" in data
        assert "counts" in data
        
        print(f"✓ Export returns valid JSON with version {data['version']}")
    
    def test_import_accepts_json(self):
        """Test POST /api/import accepts JSON"""
        import_data = {
            "version": "1.0",
            "data": {
                "members": [],
                "attendance": [],
                "guests": []
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response.status_code == 200
        
        result = response.json()
        assert result.get("success") == True
        
        print(f"✓ Import accepts valid JSON")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
