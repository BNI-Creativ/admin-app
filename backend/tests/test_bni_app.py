"""
Comprehensive Backend Tests for BNI Prezenta App
Tests: Auth, Members, Speakers, Treasury, Settings, SSE, Export/Import
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vorbitori-sync.preview.emergentagent.com')

# Test credentials from test_credentials.md
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_with_admin_credentials(self):
        """Test login with admin/admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERNAME,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["name"] == "Administrator"
        print(f"✓ Login successful - user: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_auth_me_endpoint(self, auth_token):
        """Test GET /api/auth/me returns user info"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
        print(f"✓ /api/auth/me returned user: {data['name']}")


class TestMembers:
    """Members CRUD tests"""
    
    def test_get_members(self, auth_token):
        """Test GET /api/members returns list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/members", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/members returned {len(data)} members")
    
    def test_create_member(self, auth_token):
        """Test POST /api/members creates new member"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        member_data = {
            "prenume": "TEST_Ion",
            "nume": "TEST_Popescu",
            "activ": True,
            "doreste_prezentare": True
        }
        response = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["prenume"] == "TEST_Ion"
        assert data["nume"] == "TEST_Popescu"
        assert "id" in data
        print(f"✓ Created member: {data['prenume']} {data['nume']} (id: {data['id']})")
        return data["id"]
    
    def test_update_member(self, auth_token):
        """Test PUT /api/members/{id} updates member"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # First create a member
        member_data = {"prenume": "TEST_Update", "nume": "TEST_Member"}
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=headers)
        member_id = create_resp.json()["id"]
        
        # Update the member
        update_data = {"prenume": "TEST_Updated", "data_msp": "2026-01-15"}
        response = requests.put(f"{BASE_URL}/api/members/{member_id}", json=update_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["prenume"] == "TEST_Updated"
        assert data["data_msp"] == "2026-01-15"
        print(f"✓ Updated member: {data['prenume']} with MSP date: {data['data_msp']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{member_id}", headers=headers)
    
    def test_delete_member(self, auth_token):
        """Test DELETE /api/members/{id} removes member"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # First create a member
        member_data = {"prenume": "TEST_Delete", "nume": "TEST_Me"}
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=headers)
        member_id = create_resp.json()["id"]
        
        # Delete the member
        response = requests.delete(f"{BASE_URL}/api/members/{member_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Deleted member with id: {member_id}")
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/members", headers=headers)
        members = get_resp.json()
        assert not any(m["id"] == member_id for m in members)


class TestSpeakers:
    """Speakers management tests"""
    
    def test_get_speakers_history(self, auth_token):
        """Test GET /api/speakers returns history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/speakers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/speakers returned {len(data)} history entries")
    
    def test_get_next_speakers(self, auth_token):
        """Test GET /api/speakers/next returns Round-Robin schedule"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/speakers/next", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "next_speakers" in data
        assert "eligible_count" in data
        print(f"✓ GET /api/speakers/next: {data['eligible_count']} eligible, {len(data['next_speakers'])} scheduled")
    
    def test_add_speaker_to_history(self, auth_token):
        """Test POST /api/speakers adds to history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        speaker_data = {
            "prenume": "TEST_Speaker",
            "nume": "TEST_History",
            "data": "2026-01-10"
        }
        response = requests.post(f"{BASE_URL}/api/speakers", json=speaker_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["prenume"] == "TEST_Speaker"
        assert "id" in data
        print(f"✓ Added speaker to history: {data['prenume']} {data['nume']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/speakers/{data['id']}", headers=headers)


class TestTreasury:
    """Treasury module tests"""
    
    def test_get_treasury_entries(self, auth_token):
        """Test GET /api/treasury returns entries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/treasury", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/treasury returned {len(data)} entries")
    
    def test_get_treasury_total(self, auth_token):
        """Test GET /api/treasury/total returns sum"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/treasury/total", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        print(f"✓ GET /api/treasury/total: {data['total']} RON")
    
    def test_create_treasury_entry(self, auth_token):
        """Test POST /api/treasury creates entry"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        entry_data = {
            "suma": 100.50,
            "data": "2026-01-15",
            "explicatii": "TEST_Entry"
        }
        response = requests.post(f"{BASE_URL}/api/treasury", json=entry_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["suma"] == 100.50
        assert "id" in data
        print(f"✓ Created treasury entry: {data['suma']} RON")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/treasury/{data['id']}", headers=headers)


class TestSettings:
    """Settings endpoints tests"""
    
    def test_get_speaker_interval(self, auth_token):
        """Test GET /api/settings/speaker-interval"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/speaker-interval", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "zile" in data
        print(f"✓ Speaker interval: {data['zile']} days")
    
    def test_set_speaker_interval(self, auth_token):
        """Test POST /api/settings/speaker-interval"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/settings/speaker-interval", 
                                json={"zile": 7}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Speaker interval updated successfully")
    
    def test_get_msp_validity(self, auth_token):
        """Test GET /api/settings/msp-validity"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/msp-validity", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "zile" in data
        print(f"✓ MSP validity: {data['zile']} days")
    
    def test_set_msp_validity(self, auth_token):
        """Test POST /api/settings/msp-validity"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/settings/msp-validity", 
                                json={"zile": 365}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ MSP validity updated successfully")
    
    def test_get_email_settings(self, auth_token):
        """Test GET /api/settings/emails"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/emails", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "emails" in data
        print(f"✓ Email settings: {len(data['emails'])} emails configured")


class TestAttendance:
    """Attendance/Dashboard tests"""
    
    def test_get_daily_attendance(self, auth_token):
        """Test GET /api/attendance/{date}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/attendance/2026-01-15", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "membri" in data
        assert "invitati" in data
        assert "total_taxa_membri" in data
        assert "total_taxa_invitati" in data
        print(f"✓ Attendance for 2026-01-15: {len(data['membri'])} members, {len(data['invitati'])} guests")
    
    def test_get_attendance_dates(self, auth_token):
        """Test GET /api/attendance/dates/list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/attendance/dates/list", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "dates" in data
        print(f"✓ Attendance dates: {len(data['dates'])} dates with data")
    
    def test_update_attendance(self, auth_token):
        """Test POST /api/attendance/{date}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # First get a member ID
        members_resp = requests.get(f"{BASE_URL}/api/members", headers=headers)
        members = members_resp.json()
        if not members:
            pytest.skip("No members to test attendance")
        
        member_id = members[0]["id"]
        attendance_data = {
            "member_id": member_id,
            "prezent": True,
            "taxa": 50.0,
            "nume_inlocuitor": ""
        }
        response = requests.post(f"{BASE_URL}/api/attendance/2026-01-15", 
                                json=attendance_data, headers=headers)
        assert response.status_code == 200
        print(f"✓ Updated attendance for member {member_id}")


class TestExportImport:
    """Export/Import functionality tests"""
    
    def test_export_data(self, auth_token):
        """Test GET /api/export"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/export", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        assert "data" in data
        assert "counts" in data
        print(f"✓ Export: {data['counts']['members']} members, {data['counts']['attendance']} attendance, {data['counts']['guests']} guests")
    
    def test_export_requires_auth(self):
        """Test export requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export")
        assert response.status_code in [401, 403]
        print("✓ Export correctly requires authentication")


class TestSSE:
    """Server-Sent Events tests"""
    
    def test_sse_endpoint_requires_token(self):
        """Test SSE endpoint requires valid token"""
        response = requests.get(f"{BASE_URL}/api/events?token=invalid", stream=True)
        assert response.status_code == 401
        print("✓ SSE endpoint correctly rejects invalid token")
    
    def test_sse_endpoint_with_valid_token(self, auth_token):
        """Test SSE endpoint accepts valid token"""
        # Just test that connection is established (don't wait for events)
        response = requests.get(f"{BASE_URL}/api/events?token={auth_token}", 
                               stream=True, timeout=2)
        assert response.status_code == 200
        assert response.headers.get('content-type', '').startswith('text/event-stream')
        response.close()
        print("✓ SSE endpoint accepts valid token and returns event-stream")


class TestMonthlyDeduction:
    """Monthly deduction tests (from April 2026)"""
    
    def test_get_monthly_deduction(self, auth_token):
        """Test GET /api/monthly-deduction/{year}/{month}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/monthly-deduction/2026/4", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "suma" in data
        print(f"✓ Monthly deduction for April 2026: {data['suma']} RON")
    
    def test_set_monthly_deduction(self, auth_token):
        """Test POST /api/monthly-deduction/{year}/{month}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/monthly-deduction/2026/4", 
                                json={"suma": 100.0}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "suma" in data
        print("✓ Monthly deduction updated successfully")


# Fixtures
@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.fail(f"Authentication failed: {response.text}")


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Get token for cleanup
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cleanup test members
    members_resp = requests.get(f"{BASE_URL}/api/members", headers=headers)
    if members_resp.status_code == 200:
        for member in members_resp.json():
            if member.get("prenume", "").startswith("TEST_") or member.get("nume", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=headers)
    
    # Cleanup test speakers
    speakers_resp = requests.get(f"{BASE_URL}/api/speakers", headers=headers)
    if speakers_resp.status_code == 200:
        for speaker in speakers_resp.json():
            if speaker.get("prenume", "").startswith("TEST_") or speaker.get("nume", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/speakers/{speaker['id']}", headers=headers)
    
    print("\n✓ Test data cleanup completed")
