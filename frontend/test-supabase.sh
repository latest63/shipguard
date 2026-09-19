#!/bin/bash
# Read env vars from .env.local and try to connect to Supabase
export NEXT_PUBLIC_SUPABASE_URL=""
export NEXT_PUBLIC_SUPABASE_ANON_KEY=""

# Source the env file
set -a
source /home/ubuntu/shipguard/frontend/.env.local
set +a

echo "URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "Key starts with: $(echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | cut -c1-10)"
echo "Key length: $(echo -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | wc -c)"

# Try to query the projects table
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?select=*" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>&1
