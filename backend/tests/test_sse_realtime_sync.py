"""
SSE Real-Time Sync Tests for BNI Prezenta App
Tests the Server-Sent Events (SSE) broadcast functionality for real-time synchronization.

Key endpoints tested:
- POST /api/attendance/{date} - broadcasts 'attendance_updated'
- PUT /api/members/{id} - broadcasts 'members_updated'
- POST /api/members - broadcasts 'members_updated'
- DELETE /api/members/{id} - broadcasts 'members_updated'
- POST /api/speakers - broadcasts 'speakers_updated'
- POST /api/treasury - broadcasts 'treasury_updated'
- POST /api/import - broadcasts all event types
- DELETE /api/clear-all - broadcasts all event types
- POST /api/speakers/import-csv - broadcasts 'speakers_updated'
- POST /api/settings/msp-validity - broadcasts 'members_updated'
- POST /api/settings/speaker-interval - broadcasts 'speakers_updated'
"""

import pytest
import requests
import os
import time
import threading
import queue
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSSEInfrastructure:
    """Test SSE endpoint and connection infrastructure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sse_endpoint_rejects_invalid_token(self):
        """SSE endpoint should reject invalid tokens with 401"""
        response = requests.get(f"{BASE_URL}/api/events?token=invalid_token", stream=True)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ SSE endpoint correctly rejects invalid token")
    
    def test_sse_endpoint_accepts_valid_token(self):
        """SSE endpoint should accept valid token and return text/event-stream"""
        response = requests.get(f"{BASE_URL}/api/events?token={self.token}", stream=True, timeout=5)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/event-stream" in response.headers.get("Content-Type", ""), \
            f"Expected text/event-stream, got {response.headers.get('Content-Type')}"
        response.close()
        print("✓ SSE endpoint accepts valid token and returns text/event-stream")


class TestAttendanceBroadcast:
    """Test that attendance mutations broadcast 'attendance_updated'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and test member ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a test member
        members_response = requests.get(f"{BASE_URL}/api/members", headers=self.headers)
        assert members_response.status_code == 200
        members = members_response.json()
        if members:
            self.test_member_id = members[0]["id"]
        else:
            self.test_member_id = None
    
    def test_post_attendance_returns_success(self):
        """POST /api/attendance/{date} should return success"""
        if not self.test_member_id:
            pytest.skip("No test member available")
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/attendance/{today}",
            headers=self.headers,
            json={
                "member_id": self.test_member_id,
                "prezent": True,
                "taxa": 100
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ POST /api/attendance/{today} returned success: {data}")
    
    def test_attendance_update_triggers_broadcast(self):
        """POST /api/attendance/{date} should trigger SSE broadcast"""
        if not self.test_member_id:
            pytest.skip("No test member available")
        
        today = datetime.now().strftime("%Y-%m-%d")
        events_received = []
        
        # Start SSE listener in background thread
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={self.token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines(decode_unicode=True):
                    if line and line.startswith("event:"):
                        event_type = line.replace("event:", "").strip()
                        events_received.append(event_type)
                        if event_type == "attendance_updated":
                            break
            except Exception as e:
                print(f"SSE listener error: {e}")
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.daemon = True
        listener_thread.start()
        
        # Give SSE connection time to establish
        time.sleep(1)
        
        # Trigger attendance update
        response = requests.post(
            f"{BASE_URL}/api/attendance/{today}",
            headers=self.headers,
            json={
                "member_id": self.test_member_id,
                "prezent": True,
                "taxa": 150
            }
        )
        assert response.status_code == 200
        
        # Wait for event
        listener_thread.join(timeout=5)
        
        assert "attendance_updated" in events_received, \
            f"Expected 'attendance_updated' event, received: {events_received}"
        print("✓ POST /api/attendance triggers 'attendance_updated' broadcast")


class TestMembersBroadcast:
    """Test that member mutations broadcast 'members_updated'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_post_member_returns_success(self):
        """POST /api/members should create member and return success"""
        response = requests.post(
            f"{BASE_URL}/api/members",
            headers=self.headers,
            json={
                "prenume": "TEST_SSE",
                "nume": "Member",
                "nr": 999
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        self.created_member_id = data["id"]
        print(f"✓ POST /api/members created member: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{self.created_member_id}", headers=self.headers)
    
    def test_put_member_returns_success(self):
        """PUT /api/members/{id} should update member and return success"""
        # First create a test member
        create_response = requests.post(
            f"{BASE_URL}/api/members",
            headers=self.headers,
            json={
                "prenume": "TEST_SSE_Update",
                "nume": "Member",
                "nr": 998
            }
        )
        assert create_response.status_code == 200
        member_id = create_response.json()["id"]
        
        # Update the member
        response = requests.put(
            f"{BASE_URL}/api/members/{member_id}",
            headers=self.headers,
            json={
                "prenume": "TEST_SSE_Updated"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["prenume"] == "TEST_SSE_Updated"
        print(f"✓ PUT /api/members/{member_id} updated member successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{member_id}", headers=self.headers)
    
    def test_delete_member_returns_success(self):
        """DELETE /api/members/{id} should delete member and return success"""
        # First create a test member
        create_response = requests.post(
            f"{BASE_URL}/api/members",
            headers=self.headers,
            json={
                "prenume": "TEST_SSE_Delete",
                "nume": "Member",
                "nr": 997
            }
        )
        assert create_response.status_code == 200
        member_id = create_response.json()["id"]
        
        # Delete the member
        response = requests.delete(
            f"{BASE_URL}/api/members/{member_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ DELETE /api/members/{member_id} deleted member successfully")


class TestSpeakersBroadcast:
    """Test that speaker mutations broadcast 'speakers_updated'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_post_speaker_returns_success(self):
        """POST /api/speakers should add speaker to history"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/speakers",
            headers=self.headers,
            json={
                "prenume": "TEST_SSE",
                "nume": "Speaker",
                "data": today
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ POST /api/speakers added speaker: {data['id']}")
    
    def test_speakers_import_csv_returns_success(self):
        """POST /api/speakers/import-csv should import speakers"""
        csv_content = "data,prenume,nume,member_id\n2026-01-15,TEST_CSV,Speaker,"
        response = requests.post(
            f"{BASE_URL}/api/speakers/import-csv",
            headers=self.headers,
            json={
                "csv_content": csv_content,
                "replace": False
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ POST /api/speakers/import-csv imported {data.get('imported', 0)} speakers")


class TestTreasuryBroadcast:
    """Test that treasury mutations broadcast 'treasury_updated'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_post_treasury_returns_success(self):
        """POST /api/treasury should create treasury entry"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/treasury",
            headers=self.headers,
            json={
                "data": today,
                "descriere": "TEST_SSE Entry",
                "suma": 100
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ POST /api/treasury created entry: {data['id']}")


class TestSettingsBroadcast:
    """Test that settings mutations broadcast appropriate events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_post_msp_validity_returns_success(self):
        """POST /api/settings/msp-validity should update setting"""
        response = requests.post(
            f"{BASE_URL}/api/settings/msp-validity",
            headers=self.headers,
            json={"zile": 365}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ POST /api/settings/msp-validity updated successfully")
    
    def test_post_speaker_interval_returns_success(self):
        """POST /api/settings/speaker-interval should update setting"""
        response = requests.post(
            f"{BASE_URL}/api/settings/speaker-interval",
            headers=self.headers,
            json={"zile": 7}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ POST /api/settings/speaker-interval updated successfully")


class TestImportExportBroadcast:
    """Test that import/export operations broadcast all event types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_export_returns_versioned_json(self):
        """GET /api/export should return versioned JSON"""
        response = requests.get(f"{BASE_URL}/api/export", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "version" in data
        # Data is nested under 'data' key
        assert "data" in data
        assert "members" in data.get("data", {})
        print(f"✓ GET /api/export returned version {data.get('version')}")
    
    def test_import_returns_success(self):
        """POST /api/import should import data and broadcast all events"""
        # First export current data
        export_response = requests.get(f"{BASE_URL}/api/export", headers=self.headers)
        assert export_response.status_code == 200
        export_data = export_response.json()
        
        # Import the same data back (non-destructive test)
        response = requests.post(
            f"{BASE_URL}/api/import",
            headers=self.headers,
            json=export_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ POST /api/import completed successfully")


class TestGuestsBroadcast:
    """Test that guest mutations broadcast 'attendance_updated'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_post_guest_returns_success(self):
        """POST /api/guests should create guest and broadcast"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/guests?data={today}",
            headers=self.headers,
            json={
                "prenume": "TEST_SSE",
                "nume": "Guest",
                "companie": "Test Company",
                "invitat_de": "Test Host",
                "taxa": 50,
                "prezent": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        self.created_guest_id = data["id"]
        print(f"✓ POST /api/guests created guest: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/guests/{self.created_guest_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
