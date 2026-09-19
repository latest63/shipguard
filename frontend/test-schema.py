#!/usr/bin/env python3
import requests
import os

# Read the service_role key from environment
anon_key = os.environ.get('SUPABASE_ANON_KEY', '')
# Read from .env.local
with open('.env.local', 'r') as f:
    for line in f:
        if line.startswith('NEXT_PUBLIC_SUPABASE_ANON_KEY='):
            anon_key = line.split('=', 1)[1].strip()
            break

supabase_url = "https://ervkqbncvboqsgvwjnpq.supabase.co"

print(f"Using key: {anon_key[:20]}...{anon_key[-5:]}")

# Try to query the table
response = requests.get(
    f"{supabase_url}/rest/v1/projects",
    headers={
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    },
    params={"select": "*", "limit": 1}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}")

# Also try to check the table structure using the REST API
# by trying to select individual columns
for col in ["logo_url", "avatar_url", "name", "wallet_address", "link", "profile_data"]:
    response = requests.get(
        f"{supabase_url}/rest/v1/projects",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        params={"select": col, "limit": 0}
    )
    if response.status_code == 400 and "column" in response.text.lower():
        print(f"Column {col}: MISSING ({response.text[:200]})")
    else:
        print(f"Column {col}: EXISTS (status {response.status_code})")
