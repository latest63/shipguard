#!/bin/bash
TOKEN=*** ~/.hermes/secrets/supabase-access-token)
echo "Token length: ${#TOKEN}"

# Use the Supabase Management API to run SQL
curl -s "https://api.supabase.com/v1/projects/ervkqbncvboqsgvwjnpq/sql" \
  -H "Authorization: Bearer *** -H "Content-Type: application/json" \
  -d "{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position;\"}"
