"""
Test SSE Toast Notifications Feature
=====================================
Tests the new SSE broadcast payload format that includes:
- sender (X-Client-Id header value)
- action (create/update/delete)
- member details (prenume, nume, taxa, prezent, etc.)

This enables frontend to:
1. Show toast notifications for external changes
2. Suppress toasts for own changes (sender === CLIENT_ID)
3. Silent fetch (no loading spinner) on SSE events
"""

import pytest
import requests
import os
import json
import time
import threading
import queue

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vorbitori-sync.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestSSEPayloadFormat:
    """Test that SSE broadcasts include proper payload with sender and action details"""
    
    def test_attendance_update_includes_sender_and_member_details(self, api_client, auth_token):
        """POST /api/attendance/{date} should broadcast with sender, action, prenume, nume, prezent, taxa"""
        # Get a member to update
        members_response = api_client.get(f"{BASE_URL}/api/members")
        assert members_response.status_code == 200
        members = members_response.json()
        assert len(members) > 0, "Need at least one member for test"
        
        member = members[0]
        member_id = member["id"]
        today = "2026-04-15"
        
        # Set up SSE listener in background thread
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception as e:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)  # Wait for SSE connection
        
        # Make attendance update with custom X-Client-Id
        test_client_id = "test-external-user-123"
        response = api_client.post(
            f"{BASE_URL}/api/attendance/{today}",
            json={
                "member_id": member_id,
                "prezent": True,
                "taxa": 50.0,
                "nume_inlocuitor": ""
            },
            headers={"X-Client-Id": test_client_id}
        )
        assert response.status_code == 200, f"Attendance update failed: {response.text}"
        
        time.sleep(1)  # Wait for SSE event
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check SSE event payload
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        
        # Parse the last event (should be attendance_updated)
        last_event = json.loads(events_received[-1])
        
        # Verify payload structure
        assert "sender" in last_event, "SSE payload missing 'sender' field"
        assert last_event["sender"] == test_client_id, f"Expected sender '{test_client_id}', got '{last_event.get('sender')}'"
        assert "action" in last_event, "SSE payload missing 'action' field"
        assert last_event["action"] == "update", f"Expected action 'update', got '{last_event.get('action')}'"
        assert "prenume" in last_event, "SSE payload missing 'prenume' field"
        assert "nume" in last_event, "SSE payload missing 'nume' field"
        assert "prezent" in last_event, "SSE payload missing 'prezent' field"
        assert "taxa" in last_event, "SSE payload missing 'taxa' field"
        
        print(f"✓ Attendance update SSE payload: {last_event}")
    
    def test_member_create_includes_sender_and_details(self, api_client, auth_token):
        """POST /api/members should broadcast with sender, action='create', prenume, nume"""
        test_client_id = "test-member-creator-456"
        
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Create member with custom X-Client-Id
        response = api_client.post(
            f"{BASE_URL}/api/members",
            json={"prenume": "TEST_TOAST", "nume": "Member"},
            headers={"X-Client-Id": test_client_id}
        )
        assert response.status_code == 200, f"Member create failed: {response.text}"
        created_member = response.json()
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check SSE event
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        last_event = json.loads(events_received[-1])
        
        assert last_event.get("sender") == test_client_id
        assert last_event.get("action") == "create"
        assert last_event.get("prenume") == "TEST_TOAST"
        assert last_event.get("nume") == "Member"
        
        print(f"✓ Member create SSE payload: {last_event}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/members/{created_member['id']}")
    
    def test_member_delete_includes_sender_and_details(self, api_client, auth_token):
        """DELETE /api/members/{id} should broadcast with sender, action='delete', prenume, nume"""
        test_client_id = "test-member-deleter-789"
        
        # First create a member to delete
        create_response = api_client.post(
            f"{BASE_URL}/api/members",
            json={"prenume": "TEST_DELETE", "nume": "ToastMember"}
        )
        assert create_response.status_code == 200
        member_id = create_response.json()["id"]
        
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Delete member with custom X-Client-Id
        response = api_client.delete(
            f"{BASE_URL}/api/members/{member_id}",
            headers={"X-Client-Id": test_client_id}
        )
        assert response.status_code == 200
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check SSE event
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        last_event = json.loads(events_received[-1])
        
        assert last_event.get("sender") == test_client_id
        assert last_event.get("action") == "delete"
        assert last_event.get("prenume") == "TEST_DELETE"
        assert last_event.get("nume") == "ToastMember"
        
        print(f"✓ Member delete SSE payload: {last_event}")
    
    def test_treasury_create_includes_sender_and_amount(self, api_client, auth_token):
        """POST /api/treasury should broadcast with sender, action='create', suma, explicatii"""
        test_client_id = "test-treasury-creator-101"
        
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Create treasury entry with custom X-Client-Id
        response = api_client.post(
            f"{BASE_URL}/api/treasury",
            json={"suma": 123.45, "data": "2026-04-15", "explicatii": "Test toast entry"},
            headers={"X-Client-Id": test_client_id}
        )
        assert response.status_code == 200
        entry = response.json()
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check SSE event
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        last_event = json.loads(events_received[-1])
        
        assert last_event.get("sender") == test_client_id
        assert last_event.get("action") == "create"
        assert last_event.get("suma") == 123.45
        assert last_event.get("explicatii") == "Test toast entry"
        
        print(f"✓ Treasury create SSE payload: {last_event}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/treasury/{entry['id']}")
    
    def test_speaker_add_includes_sender_and_details(self, api_client, auth_token):
        """POST /api/speakers should broadcast with sender, action='create', prenume, nume"""
        test_client_id = "test-speaker-adder-202"
        
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Add speaker with custom X-Client-Id
        response = api_client.post(
            f"{BASE_URL}/api/speakers",
            json={"prenume": "TEST_SPEAKER", "nume": "ToastTest", "data": "2026-04-15"},
            headers={"X-Client-Id": test_client_id}
        )
        assert response.status_code == 200
        speaker = response.json()
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check SSE event
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        last_event = json.loads(events_received[-1])
        
        assert last_event.get("sender") == test_client_id
        assert last_event.get("action") == "create"
        assert last_event.get("prenume") == "TEST_SPEAKER"
        assert last_event.get("nume") == "ToastTest"
        
        print(f"✓ Speaker add SSE payload: {last_event}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/speakers/{speaker['id']}")
    
    def test_guest_add_includes_sender_and_details(self, api_client, auth_token):
        """POST /api/guests should broadcast with sender, action='guest_add', prenume, nume"""
        test_client_id = "test-guest-adder-303"
        today = "2026-04-15"
        
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Add guest with custom X-Client-Id
        response = api_client.post(
            f"{BASE_URL}/api/guests?data={today}",
            json={
                "prenume": "TEST_GUEST",
                "nume": "ToastGuest",
                "companie": "Test Co",
                "invitat_de": "",
                "taxa": 25.0,
                "prezent": False
            },
            headers={"X-Client-Id": test_client_id}
        )
        assert response.status_code == 200
        guest = response.json()
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check SSE event
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        last_event = json.loads(events_received[-1])
        
        assert last_event.get("sender") == test_client_id
        assert last_event.get("action") == "guest_add"
        assert last_event.get("prenume") == "TEST_GUEST"
        assert last_event.get("nume") == "ToastGuest"
        
        print(f"✓ Guest add SSE payload: {last_event}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/guests/{guest['id']}")


class TestClientIdMiddleware:
    """Test that X-Client-Id header is properly extracted by middleware"""
    
    def test_middleware_extracts_client_id(self, api_client, auth_token):
        """Verify middleware extracts X-Client-Id and includes it in broadcast"""
        unique_client_id = f"unique-test-{int(time.time())}"
        
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Create and immediately delete a member with unique client ID
        create_response = api_client.post(
            f"{BASE_URL}/api/members",
            json={"prenume": "TEST_MIDDLEWARE", "nume": "Check"},
            headers={"X-Client-Id": unique_client_id}
        )
        assert create_response.status_code == 200
        member_id = create_response.json()["id"]
        
        time.sleep(0.5)
        
        # Delete with same client ID
        api_client.delete(
            f"{BASE_URL}/api/members/{member_id}",
            headers={"X-Client-Id": unique_client_id}
        )
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check all events have the correct sender
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) >= 2, f"Expected at least 2 events, got {len(events_received)}"
        
        for event_str in events_received:
            event = json.loads(event_str)
            assert event.get("sender") == unique_client_id, f"Event sender mismatch: {event}"
        
        print(f"✓ Middleware correctly extracted X-Client-Id for {len(events_received)} events")
    
    def test_empty_client_id_when_header_missing(self, api_client, auth_token):
        """When X-Client-Id header is missing, sender should be empty string"""
        # Set up SSE listener
        sse_events = queue.Queue()
        stop_event = threading.Event()
        
        def listen_sse():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/events?token={auth_token}",
                    stream=True,
                    timeout=10
                )
                for line in response.iter_lines():
                    if stop_event.is_set():
                        break
                    if line:
                        decoded = line.decode('utf-8')
                        if decoded.startswith('data:'):
                            sse_events.put(decoded[5:].strip())
            except Exception:
                pass
        
        listener_thread = threading.Thread(target=listen_sse)
        listener_thread.start()
        time.sleep(0.5)
        
        # Create member WITHOUT X-Client-Id header
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        # Explicitly NOT setting X-Client-Id
        
        create_response = session.post(
            f"{BASE_URL}/api/members",
            json={"prenume": "TEST_NO_CLIENT", "nume": "ID"}
        )
        assert create_response.status_code == 200
        member_id = create_response.json()["id"]
        
        time.sleep(1)
        stop_event.set()
        listener_thread.join(timeout=2)
        
        # Check event has empty sender
        events_received = []
        while not sse_events.empty():
            events_received.append(sse_events.get())
        
        assert len(events_received) > 0, "No SSE events received"
        last_event = json.loads(events_received[-1])
        
        assert last_event.get("sender") == "", f"Expected empty sender, got '{last_event.get('sender')}'"
        
        print(f"✓ Empty sender when X-Client-Id header missing: {last_event}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/members/{member_id}")


class TestLoginAndPageLoad:
    """Basic tests to ensure login and pages work"""
    
    def test_login_works(self):
        """Verify login with admin/admin123 works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Login successful: {data['user']['name']}")
    
    def test_all_api_endpoints_accessible(self, api_client):
        """Verify all main API endpoints are accessible"""
        endpoints = [
            "/api/members",
            "/api/attendance/2026-04-15",
            "/api/speakers",
            "/api/treasury",
            "/api/settings/emails",
            "/api/settings/msp-validity",
            "/api/settings/speaker-interval"
        ]
        
        for endpoint in endpoints:
            response = api_client.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 200, f"Endpoint {endpoint} failed: {response.status_code}"
            print(f"✓ {endpoint} accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
