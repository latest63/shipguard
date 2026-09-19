#!/usr/bin/env python3
import requests
import json

SUPABASE_URL = "https://api.supabase.com/v1/projects/ervkqbncvboqsgvwjnpq"
TOKEN = "REPLACE_SB_PAT"

# First, try to get the anon key using the Management API
response = requests.get(
    f"{SUPABASE_URL}/api-keys",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
)
print(f"API Keys request status: {response.status_code}")
print(f"Response: {response.text[:1000]}")

if response.status_code == 200:
    keys = response.json()
    print(f"\nKeys found: {keys}")
    for key in keys:
        print(f"  - {key.get('name')}: {key.get('key')[:20]}...")
