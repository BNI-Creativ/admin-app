#!/usr/bin/env python3
"""
Backend API Testing for Romanian Members & Guests Management App
Tests all CRUD operations, authentication, and attendance management
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any

class MembersGuestsAPITester:
    def __init__(self, base_url="https://membertracker-4.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_member_id = None
        self.created_guest_id = None

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Dict[Any, Any] = None, params: Dict[str, str] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"    URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = f"Status: {response.status_code}, Expected: {expected_status}"
            if not success:
                details += f", Response: {response_data}"
            
            self.log_result(name, success, details)
            return success, response_data

        except Exception as e:
            self.log_result(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET", "", 200
        )
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@test.ro",
            "password": "TestPass123!",
            "name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST", "auth/register", 200, test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"    ✅ Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        # First register a user
        test_email = f"login_test_{datetime.now().strftime('%H%M%S')}@test.ro"
        register_data = {
            "email": test_email,
            "password": "LoginTest123!",
            "name": "Login Test User"
        }
        
        # Register user
        reg_success, reg_response = self.run_test(
            "Pre-Login Registration",
            "POST", "auth/register", 200, register_data
        )
        
        if not reg_success:
            return False
        
        # Now test login
        login_data = {
            "email": test_email,
            "password": "LoginTest123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST", "auth/login", 200, login_data
        )
        
        return success and 'access_token' in response

    def test_get_current_user(self):
        """Test getting current user info"""
        if not self.token:
            self.log_result("Get Current User", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET", "auth/me", 200
        )
        
        return success and 'email' in response

    def test_create_member(self):
        """Test creating a new member"""
        if not self.token:
            self.log_result("Create Member", False, "No token available")
            return False
            
        member_data = {
            "prenume": "Ion",
            "nume": "Popescu",
            "nume_inlocuitor": "Ionel"
        }
        
        success, response = self.run_test(
            "Create Member",
            "POST", "members", 200, member_data
        )
        
        if success and 'id' in response:
            self.created_member_id = response['id']
            print(f"    ✅ Member created with ID: {self.created_member_id}")
            return True
        return False

    def test_get_members(self):
        """Test getting all members"""
        if not self.token:
            self.log_result("Get Members", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Members",
            "GET", "members", 200
        )
        
        return success and isinstance(response, list)

    def test_update_member(self):
        """Test updating a member"""
        if not self.token or not self.created_member_id:
            self.log_result("Update Member", False, "No token or member ID available")
            return False
            
        update_data = {
            "prenume": "Ion Updated",
            "nume": "Popescu Updated"
        }
        
        success, response = self.run_test(
            "Update Member",
            "PUT", f"members/{self.created_member_id}", 200, update_data
        )
        
        return success

    def test_create_guest(self):
        """Test creating a guest"""
        if not self.token:
            self.log_result("Create Guest", False, "No token available")
            return False
            
        today = date.today().strftime('%Y-%m-%d')
        guest_data = {
            "prenume": "Maria",
            "nume": "Ionescu",
            "companie": "Test Company",
            "invitat_de": "Ion Popescu",
            "taxa": 50.0
        }
        
        success, response = self.run_test(
            "Create Guest",
            "POST", f"guests?data={today}", 200, guest_data
        )
        
        if success and 'id' in response:
            self.created_guest_id = response['id']
            print(f"    ✅ Guest created with ID: {self.created_guest_id}")
            return True
        return False

    def test_get_guests(self):
        """Test getting guests for a date"""
        if not self.token:
            self.log_result("Get Guests", False, "No token available")
            return False
            
        today = date.today().strftime('%Y-%m-%d')
        success, response = self.run_test(
            "Get Guests",
            "GET", f"guests/{today}", 200
        )
        
        return success and isinstance(response, list)

    def test_update_guest(self):
        """Test updating a guest"""
        if not self.token or not self.created_guest_id:
            self.log_result("Update Guest", False, "No token or guest ID available")
            return False
            
        update_data = {
            "prenume": "Maria Updated",
            "taxa": 75.0
        }
        
        success, response = self.run_test(
            "Update Guest",
            "PUT", f"guests/{self.created_guest_id}", 200, update_data
        )
        
        return success

    def test_attendance_operations(self):
        """Test attendance operations"""
        if not self.token or not self.created_member_id:
            self.log_result("Attendance Operations", False, "No token or member ID available")
            return False
            
        today = date.today().strftime('%Y-%m-%d')
        
        # Test getting daily attendance
        get_success, get_response = self.run_test(
            "Get Daily Attendance",
            "GET", f"attendance/{today}", 200
        )
        
        if not get_success:
            return False
        
        # Test updating attendance
        attendance_data = {
            "member_id": self.created_member_id,
            "prezent": True,
            "taxa": 100.0
        }
        
        update_success, update_response = self.run_test(
            "Update Attendance",
            "POST", f"attendance/{today}", 200, attendance_data
        )
        
        return update_success

    def test_get_attendance_dates(self):
        """Test getting attendance dates list"""
        if not self.token:
            self.log_result("Get Attendance Dates", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Attendance Dates",
            "GET", "attendance/dates/list", 200
        )
        
        return success and 'dates' in response

    def test_delete_operations(self):
        """Test delete operations"""
        if not self.token:
            self.log_result("Delete Operations", False, "No token available")
            return False
            
        success_count = 0
        
        # Delete guest
        if self.created_guest_id:
            guest_success, _ = self.run_test(
                "Delete Guest",
                "DELETE", f"guests/{self.created_guest_id}", 200
            )
            if guest_success:
                success_count += 1
        
        # Delete member
        if self.created_member_id:
            member_success, _ = self.run_test(
                "Delete Member",
                "DELETE", f"members/{self.created_member_id}", 200
            )
            if member_success:
                success_count += 1
        
        return success_count > 0

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Romanian Members & Guests API Testing")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_root_endpoint,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_current_user,
            self.test_create_member,
            self.test_get_members,
            self.test_update_member,
            self.test_create_guest,
            self.test_get_guests,
            self.test_update_guest,
            self.test_attendance_operations,
            self.test_get_attendance_dates,
            self.test_delete_operations
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_result(f"Exception in {test.__name__}", False, str(e))
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = MembersGuestsAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'failed_tests': tester.tests_run - tester.tests_passed,
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
            },
            'detailed_results': tester.test_results,
            'timestamp': datetime.now().isoformat()
        }, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())