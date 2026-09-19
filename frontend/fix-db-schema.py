#!/usr/bin/env python3
import psycopg2
import os

# Read pooler connection string from secrets
pooler_url = ""
db_password = ""
with open("/home/ubuntu/.hermes/secrets/supabase-pooler.env", "r") as f:
    for line in f:
        if line.startswith("SUPABASE_POOLER="):
            pooler_url = line.split("=", 1)[1].strip()
        if line.startswith("DB_PASSWORD="):
            db_password = line.split("=", 1)[1].strip()

print("Pooler URL:", pooler_url[:40] + "...")
print("DB Password found:", len(db_password) > 0)

# The pooler URL contains the password embedded
# Format: postgresql://postgres.hmscxbdocwfasnmcidpd:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
# Let's use it directly
conn_str = pooler_url
print("Connecting to database...")
try:
    conn = psycopg2.connect(conn_str)
    cursor = conn.cursor()
    
    # Check columns
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        ORDER BY ordinal_position
    """)
    columns = cursor.fetchall()
    print("Projects table columns:")
    for col in columns:
        print(f"  - {col[0]} ({col[1]})")
    
    col_names = [col[0] for col in columns]
    if "avatar_url" in col_names and "logo_url" not in col_names:
        print("\nRenaming avatar_url to logo_url...")
        cursor.execute("ALTER TABLE projects RENAME COLUMN avatar_url TO logo_url;")
        conn.commit()
        print("Done!")
    
    # Verify
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        ORDER BY ordinal_position
    """)
    columns = cursor.fetchall()
    print("\nUpdated columns:")
    for col in columns:
        print(f"  - {col[0]} ({col[1]})")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
