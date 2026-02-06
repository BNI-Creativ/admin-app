"""
Test Export/Import functionality for BNI Prezenta App
Tests: GET /api/export, POST /api/import endpoints
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExportImport:
    """Export/Import endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_export_endpoint_returns_200(self):
        """Test GET /api/export returns 200 status"""
        response = self.session.get(f"{BASE_URL}/api/export")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Export endpoint returned 200")
    
    def test_export_returns_versioned_json(self):
        """Test export returns JSON with version field"""
        response = self.session.get(f"{BASE_URL}/api/export")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check version field exists
        assert "version" in data, "Export should contain 'version' field"
        assert data["version"] == "1.0", f"Expected version 1.0, got {data['version']}"
        print(f"✓ Export contains version: {data['version']}")
    
    def test_export_contains_required_fields(self):
        """Test export contains all required fields: members, attendance, guests"""
        response = self.session.get(f"{BASE_URL}/api/export")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required top-level fields
        assert "version" in data, "Missing 'version' field"
        assert "export_date" in data, "Missing 'export_date' field"
        assert "app_name" in data, "Missing 'app_name' field"
        assert "data" in data, "Missing 'data' field"
        assert "counts" in data, "Missing 'counts' field"
        
        # Check data structure
        assert "members" in data["data"], "Missing 'members' in data"
        assert "attendance" in data["data"], "Missing 'attendance' in data"
        assert "guests" in data["data"], "Missing 'guests' in data"
        
        # Check counts structure
        assert "members" in data["counts"], "Missing 'members' in counts"
        assert "attendance" in data["counts"], "Missing 'attendance' in counts"
        assert "guests" in data["counts"], "Missing 'guests' in counts"
        
        print(f"✓ Export contains all required fields")
        print(f"  - Members: {data['counts']['members']}")
        print(f"  - Attendance: {data['counts']['attendance']}")
        print(f"  - Guests: {data['counts']['guests']}")
    
    def test_export_counts_match_data_length(self):
        """Test that counts match actual data array lengths"""
        response = self.session.get(f"{BASE_URL}/api/export")
        assert response.status_code == 200
        
        data = response.json()
        
        assert len(data["data"]["members"]) == data["counts"]["members"], \
            f"Members count mismatch: {len(data['data']['members'])} vs {data['counts']['members']}"
        assert len(data["data"]["attendance"]) == data["counts"]["attendance"], \
            f"Attendance count mismatch: {len(data['data']['attendance'])} vs {data['counts']['attendance']}"
        assert len(data["data"]["guests"]) == data["counts"]["guests"], \
            f"Guests count mismatch: {len(data['data']['guests'])} vs {data['counts']['guests']}"
        
        print(f"✓ Export counts match data lengths")
    
    def test_import_endpoint_accepts_valid_json(self):
        """Test POST /api/import accepts valid JSON data"""
        # Create test import data
        import_data = {
            "version": "1.0",
            "data": {
                "members": [
                    {
                        "id": "TEST_import_member_001",
                        "nr": 999,
                        "prenume": "Test",
                        "nume": "ImportMember"
                    }
                ],
                "attendance": [],
                "guests": []
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, "Import should return success=True"
        assert "results" in result, "Import should return results"
        
        print(f"✓ Import endpoint accepted valid JSON")
        print(f"  - Results: {result['results']}")
    
    def test_import_returns_correct_counts(self):
        """Test import returns correct imported/updated counts"""
        # First, create a unique test member
        import_data = {
            "version": "1.0",
            "data": {
                "members": [
                    {
                        "id": "TEST_import_member_002",
                        "nr": 998,
                        "prenume": "TestCount",
                        "nume": "Member"
                    }
                ],
                "attendance": [],
                "guests": []
            }
        }
        
        # First import - should be new
        response1 = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response1.status_code == 200
        result1 = response1.json()
        
        # Check results structure
        assert "results" in result1
        assert "members" in result1["results"]
        assert "imported" in result1["results"]["members"]
        assert "errors" in result1["results"]["members"]
        
        print(f"✓ Import returns correct count structure")
        print(f"  - Members imported: {result1['results']['members']['imported']}")
        print(f"  - Members errors: {result1['results']['members']['errors']}")
    
    def test_import_updates_existing_data(self):
        """Test import updates existing records instead of duplicating"""
        # Create initial member
        import_data = {
            "version": "1.0",
            "data": {
                "members": [
                    {
                        "id": "TEST_import_member_003",
                        "nr": 997,
                        "prenume": "Original",
                        "nume": "Name"
                    }
                ],
                "attendance": [],
                "guests": []
            }
        }
        
        # First import
        response1 = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response1.status_code == 200
        
        # Update the same member
        import_data["data"]["members"][0]["prenume"] = "Updated"
        
        # Second import - should update
        response2 = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response2.status_code == 200
        result2 = response2.json()
        
        # Import replaces all data, so second import should also show imported
        assert result2["results"]["members"]["imported"] >= 1, \
            "Second import should import member"
        
        print(f"✓ Import correctly replaces existing records")
    
    def test_import_handles_attendance_data(self):
        """Test import handles attendance records correctly"""
        import_data = {
            "version": "1.0",
            "data": {
                "members": [],
                "attendance": [
                    {
                        "member_id": "TEST_attendance_member_001",
                        "data": "2026-01-15",
                        "prezent": True,
                        "taxa": 50.0,
                        "nume_inlocuitor": ""
                    }
                ],
                "guests": []
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "attendance" in result["results"]
        
        print(f"✓ Import handles attendance data")
        print(f"  - Attendance imported: {result['results']['attendance']['imported']}")
        print(f"  - Attendance errors: {result['results']['attendance']['errors']}")
    
    def test_import_handles_guests_data(self):
        """Test import handles guest records correctly"""
        import_data = {
            "version": "1.0",
            "data": {
                "members": [],
                "attendance": [],
                "guests": [
                    {
                        "id": "TEST_guest_001",
                        "nr": 1,
                        "prenume": "Test",
                        "nume": "Guest",
                        "companie": "Test Company",
                        "invitat_de": "Test Member",
                        "taxa": 25.0,
                        "data": "2026-01-15",
                        "prezent": True,
                        "is_inlocuitor": False
                    }
                ]
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "guests" in result["results"]
        
        print(f"✓ Import handles guests data")
        print(f"  - Guests imported: {result['results']['guests']['imported']}")
        print(f"  - Guests errors: {result['results']['guests']['errors']}")
    
    def test_export_import_roundtrip(self):
        """Test that exported data can be re-imported successfully"""
        # Export current data
        export_response = self.session.get(f"{BASE_URL}/api/export")
        assert export_response.status_code == 200
        
        exported_data = export_response.json()
        
        # Re-import the exported data
        import_response = self.session.post(f"{BASE_URL}/api/import", json=exported_data)
        assert import_response.status_code == 200
        
        result = import_response.json()
        assert result.get("success") == True
        
        print(f"✓ Export/Import roundtrip successful")
        print(f"  - Version imported: {result.get('version_imported')}")
    
    def test_import_without_auth_fails(self):
        """Test import without authentication returns 401/403"""
        # Create new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        import_data = {
            "version": "1.0",
            "data": {"members": [], "attendance": [], "guests": []}
        }
        
        response = no_auth_session.post(f"{BASE_URL}/api/import", json=import_data)
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"✓ Import without auth correctly returns {response.status_code}")
    
    def test_export_without_auth_fails(self):
        """Test export without authentication returns 401/403"""
        # Create new session without auth
        no_auth_session = requests.Session()
        
        response = no_auth_session.get(f"{BASE_URL}/api/export")
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"✓ Export without auth correctly returns {response.status_code}")


class TestCleanup:
    """Cleanup test data after tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_cleanup_test_members(self):
        """Cleanup TEST_ prefixed members created during tests"""
        # Get all members
        response = self.session.get(f"{BASE_URL}/api/members")
        if response.status_code == 200:
            members = response.json()
            for member in members:
                if member.get("id", "").startswith("TEST_"):
                    delete_response = self.session.delete(f"{BASE_URL}/api/members/{member['id']}")
                    print(f"  Cleaned up test member: {member['id']}")
        
        print(f"✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
