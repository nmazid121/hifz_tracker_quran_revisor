#!/usr/bin/env python3
"""
Test script for QUL endpoints
Run this to verify that the new surah names and page layout endpoints are working.
"""

import requests
import json
import time
import subprocess
import sys
import os

def test_endpoints():
    """Test the QUL endpoints"""
    base_url = "http://localhost:5000"
    
    print("🧪 Testing QUL Endpoints")
    print("=" * 50)
    
    # Test 1: Surah Names Endpoint
    print("\n1. Testing /api/quran/surah-names")
    try:
        response = requests.get(f"{base_url}/api/quran/surah-names", timeout=10)
        if response.status_code == 200:
            surah_names = response.json()
            print(f"✅ Surah names endpoint works!")
            print(f"   - Total surahs: {len(surah_names)}")
            print(f"   - Sample: Surah 1 = {surah_names.get('1', 'N/A')}")
            print(f"   - Sample: Surah 2 = {surah_names.get('2', 'N/A')}")
            print(f"   - Sample: Surah 114 = {surah_names.get('114', 'N/A')}")
        else:
            print(f"❌ Surah names endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Surah names endpoint error: {e}")

    # Test 2: Page Layout Endpoint
    print("\n2. Testing /api/quran/page-layout/1 (first page)")
    try:
        response = requests.get(f"{base_url}/api/quran/page-layout/1", timeout=10)
        if response.status_code == 200:
            page_data = response.json()
            print(f"✅ Page layout endpoint works!")
            print(f"   - Page layout lines: {len(page_data.get('pageLayout', []))}")
            print(f"   - Word data entries: {len(page_data.get('wordData', {}))}")
            
            # Show line types on first page
            line_types = [line.get('line_type') for line in page_data.get('pageLayout', [])]
            print(f"   - Line types on page 1: {set(line_types)}")
        else:
            print(f"❌ Page layout endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Page layout endpoint error: {e}")

    # Test 3: Original Page Endpoint (for comparison)
    print("\n3. Testing original /api/quran/page/1")
    try:
        response = requests.get(f"{base_url}/api/quran/page/1", timeout=10)
        if response.status_code == 200:
            original_data = response.json()
            print(f"✅ Original page endpoint still works!")
            print(f"   - Page data lines: {len(original_data.get('pageData', []))}")
            print(f"   - Word data entries: {len(original_data.get('wordData', {}))}")
        else:
            print(f"❌ Original page endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Original page endpoint error: {e}")

    print("\n" + "=" * 50)
    print("🏁 Testing complete!")

def check_server():
    """Check if server is running"""
    try:
        response = requests.get("http://localhost:5000/api/quran/test", timeout=5)
        return response.status_code == 200
    except:
        return False

if __name__ == "__main__":
    # Check if server is running
    if not check_server():
        print("❌ Flask server is not running on localhost:5000")
        print("🚀 Please start the server first:")
        print("   cd backend && python3 app.py")
        sys.exit(1)
    
    # Run tests
    test_endpoints()