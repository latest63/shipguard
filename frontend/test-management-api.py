#!/usr/bin/env python3
import requests
import json

# Read Management API token
with open("/home/ubuntu/.hermes/secrets/supabase-access-token","r") as f:
    TOKEN=f.read()...
    TOKEN=raw_token.strip()

print(f"Token: {TOKEN}")
print(f"Token length: {len(TOKEN)}")
print(f"Token prefix: {TOKEN[:6]}")

BASE_URL = "https://api.supabase.com"

# Step 1: Check what endpoints are available
# The SQL execution endpoint in Supabase Management API is:
# POST /v1/projects/{reference}/sql

# Let's try with proper headers
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Try executing SQL
sql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position;"

resp = requests.post(
    f"{BASE_URL}/v1/projects/ervkqbncvboqsgvwjnpq/sql",
    headers=headers,
    json={"query": sql}
)
print(f"\nSQL query result: {resp.status_code}")
print(f"Response: {resp.text[:500]}")
