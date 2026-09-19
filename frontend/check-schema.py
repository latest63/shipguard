#!/usr/bin/env python3
import requests
import json

SUPABASE_API="https://api.supabase.com/v1"
PROJECT_REF="ervkqbncvboqsgvwjnpq"

with open("/home/ubuntu/.hermes/secrets/supabase-access-token","r") as f:
    TOKEN=f.read().strip()

headers={"Authorization": f"Bearer {TOKEN}", "Content-Type":"application/json"}

# Check current schema
resp=requests.post(
    f"{SUPABASE_API}/projects/{PROJECT_REF}/sql",
    headers=headers,
    json={"query":"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position;"}
)
print(f"Schema check: {resp.status_code}")
if resp.status_code == 200:
    data=resp.json()
    cols=[row.get("column_name") for row in data.get("result",[])]
    print(f"Columns: {cols}")
else:
    print(f"Response: {resp.text[:500]}")
