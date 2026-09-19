#!/usr/bin/env python3
import requests
import json

SUPABASE_URL="https://api.supabase.com"
PROJECT_REF="ervkqbncvboqsgvwjnpq"

with open("/home/ubuntu/.hermes/secrets/supabase-access-token","r") as f:
    raw = f.read().strip()
    print(f"Token length: {len(raw)}")

# Use the raw token for all requests
headers = {
    "Authorization": f"Bearer {raw}",
    "Content-Type": "application/json",
}

# Try different SQL endpoint variations
for path in ["/v1/projects/" + PROJECT_REF + "/sql", "/v1/projects/" + PROJECT_REF + "/sql"]:
    response = requests.post(SUPABASE_URL + path, headers=headers, json={"query": "SELECT 1;"})
    print(f"Endpoint {path} -> {response.status_code}: {response.text[:200]}")
    
# Also try getting database pooler info
response = requests.get(SUPABASE_URL + "/v1/projects/" + PROJECT_REF, headers=headers)
print(f"Project info -> {response.status_code}: {response.text[:200]}")
