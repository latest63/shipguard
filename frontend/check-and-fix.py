#!/usr/bin/env python3
import requests
import json

SUPABASE_URL = "https://api.supabase.com/v1"

# Read token from file
with open("/home/ubuntu/.hermes/secrets/supabase-access-token", "r") as f:
    MANAGEMENT_TOKEN = f.read().strip()

print(f"Token length: {len(MANAGEMENT_TOKEN)}...")

PROJECT_REF = "ervkqbncvboqsgvwjnpq"

# Try to get project info
response = requests.get(
    f"{SUPABASE_URL}/projects/{PROJECT_REF}",
    headers={
        "Authorization": f"Bearer {MANAGEMENT_TOKEN}",
        "Content-Type": "application/json"
    }
)
print(f"Project info status: {response.status_code}")
if response.status_code == 200:
    proj = response.json()
    print(f"Project: {proj.get('name')}")
    print(f"Database: {proj.get('database')}")
    print(f"Region: {proj.get('region')}")

# Try the SQL endpoint - check correct format
# Supabase Management API uses /v1/projects/{ref}/sql
response = requests.post(
    f"{SUPABASE_URL}/projects/{PROJECT_REF}/sql",
    headers={
        "Authorization": f"Bearer {MANAGEMENT_TOKEN}",
        "Content-Type": "application/json"
    },
    json={"query": "SELECT 1;"}
)
print(f"\nSQL endpoint status: {response.status_code}")
print(f"SQL response: {response.text[:500]}")

# Also try to get the service_role key and use it directly
response = requests.get(
    f"{SUPABASE_URL}/projects/{PROJECT_REF}/api-keys",
    headers={
        "Authorization": f"Bearer {MANAGEMENT_TOKEN}",
        "Content-Type": "application/json"
    }
)
print(f"\nAPI keys status: {response.status_code}")
if response.status_code == 200:
    keys = response.json()
    for key in keys:
        if key.get("id") == "service_role":
            service_key = key.get("api_key")
            print(f"Service role key: {service_key[:20]}...{service_key[-10:]}")
            
            # Use service role key to check schema
            supabase_url = "https://ervkqbncvboqsgvwjnpq.supabase.co"
            response = requests.post(
                f"{supabase_url}/rest/v1/rpc",
                headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json"
                },
                json={"params": [], "sql": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position;"}
            )
            print(f"RPC status: {response.status_code}")
            print(f"RPC response: {response.text[:500]}")
