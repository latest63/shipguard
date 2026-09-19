#!/usr/bin/env python3
import subprocess
import os
import re

# Read password from .pgpass
with open(os.path.expanduser('~/.pgpass'), 'r') as f:
    for line in f:
        parts = line.strip().split(':')
        if len(parts) >= 5:
            password = parts[4]
            break

os.chdir('/home/ubuntu/shipguard/frontend')
os.environ['SUPABASE_PASSWORD'] = password

# Link the project
result = subprocess.run(
    ['supabase', 'link', '--project-ref', 'ervkqbncvboqsgvwjnpq', '--password', password],
    capture_output=True, text=True
)
print("Link stdout:", result.stdout)
print("Link stderr:", result.stderr)
print("Link returncode:", result.returncode)

# Push the migration
result = subprocess.run(
    ['supabase', 'db', 'push', '--password', password],
    capture_output=True, text=True
)
print("\nPush stdout:", result.stdout)
print("Push stderr:", result.stderr)
print("Push returncode:", result.returncode)
