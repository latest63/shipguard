#!/usr/bin/env python3
import requests
import json

SUPABASE_URL = "https://api.supabase.com/v1/projects/ervkqbncvboqsgvwjnpq"

# Read token from file
with open("/home/ubuntu/.hermes/secrets/supabase-access-token", "r") as f:
    MANAGEMENT_TOKEN = f.read().strip()

print(f"Token length: {len(MANAGEMENT_TOKEN)}")

# Get the actual anon key and service_role key
response = requests.get(
    f"{SUPABASE_URL}/api-keys",
    headers={
        "Authorization": f"Bearer {MANAGEMENT_TOKEN}",
        "Content-Type": "application/json"
    }
)

keys = response.json()
anon_key = None
service_role_key = None
for key in keys:
    if key.get("id") == "anon":
        anon_key = key.get("api_key")
    if key.get("id") == "service_role":
        service_role_key = key.get("api_key")

if anon_key:
    print(f"Anon key found: {anon_key[:20]}...{anon_key[-10:]}")
else:
    print("Anon key not found!")

if service_role_key:
    print(f"Service role key found: {service_role_key[:20]}...{service_role_key[-10:]}")

# Check current schema using SQL endpoint
sql_query = {
    "query": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position;"
}

response = requests.post(
    f"{SUPABASE_URL}/sql",
    headers={
        "Authorization": f"Bearer {MANAGEMENT_TOKEN}",
        "Content-Type": "application/json"
    },
    json=sql_query
)

print(f"\nSchema check status: {response.status_code}")
print(f"Schema response: {response.text[:500]}")

if response.status_code == 200:
    result = response.json()
    columns = [row.get("column_name") for row in result]
    print(f"\nCurrent columns: {columns}")
    
    if "avatar_url" in columns and "logo_url" not in columns:
        print("\nNeed to rename avatar_url to logo_url")
        alter_sql = {
            "query": "ALTER TABLE projects RENAME COLUMN avatar_url TO logo_url;"
        }
        response = requests.post(
            f"{SUPABASE_URL}/sql",
            headers={
                "Authorization": f"Bearer {MANAGEMENT_TOKEN}",
                "Content-Type": "application/json"
            },
            json=alter_sql
        )
        print(f"ALTER TABLE result: {response.status_code} - {response.text[:200]}")
    elif "logo_url" in columns:
        print("\nlogo_url already exists!")
    else:
        print("\nNeither avatar_url nor logo_url found")
