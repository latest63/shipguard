#!/usr/bin/env python3
import requests
import json

TOKEN=*** length: {len(TOKEN)}")

# Supabase Management API
BASE = "https://api.supabase.com"
REF = "ervkqbncvboqsgvwjnpq"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Try different endpoint patterns for running SQL
endpoints = [
    "POST /v1/projects/{REF}/sql",
    "POST /v1/projects/{REF}/database/sql",
    "POST /v1/projects/{REF}/rest/rpc",
    "POST /v1/projects/{REF}/query",
]

for endpoint in endpoints:
    url = endpoint.replace("{REF}", REF)
    method, path = url.split(" ", 1)
    full_url = BASE + path
    
    try:
        if method == "POST":
            resp = requests.post(full_url, headers=HEADERS, json={"query": "SELECT 1;"})
        else:
            resp = requests.get(full_url, headers=HEADERS)
        print(f"{endpoint:50s} -> {resp.status_code}")
        if resp.status_code != 404:
            print(f"  Response: {resp.text[:300]}")
    except Exception as e:
        print(f"{endpoint:50s} -> ERROR: {e}")

# Also try the service_role key approach with the Supabase REST API
# First, get the service_role key
resp = requests.get(f"{BASE}/v1/projects/{REF}/api-keys", headers=HEADERS)
print(f"\nAPI keys endpoint: {resp.status_code}")
if resp.status_code == 200:
    keys = resp.json()
    service_role = None
    for key in keys:
        if key.get("id") == "service_role":
            service_role = key.get("api_key")
    if service_role:
        print(f"Service role key: {service_role[:30]}...")
        
        # Use service role to run SQL via the postgREST REST API
        supabase_url = f"https://{REF}.supabase.co"
        resp2 = requests.get(
            f"{supabase_url}/rest/v1/projects?select=name&limit=1",
            headers={
                "apikey": service_role,
                "Authorization": f"Bearer {service_role}",
            }
        )
        print(f"REST API test: {resp2.status_code}")
        print(f"Response: {resp2.text[:300]}")
