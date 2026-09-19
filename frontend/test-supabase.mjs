#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Use the service_role key directly
const supabaseUrl = 'https://ervkqbncvboqsgvwjnpq.supabase.co';
const supabaseKey = 'eyJhbG...mFC4'; // anon key from .env.local

console.log('Testing with anon key...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Check columns by trying to query each one
  const columns = ['wallet_address', 'name', 'logo_url', 'avatar_url', 'link', 'profile_data', 'github_handle', 'created_at', 'updated_at'];
  
  for (const col of columns) {
    try {
      const { data, error } = await supabase.from('projects').select(col).limit(0);
      if (error) {
        console.log(`Column ${col}: ERROR - ${error.message}`);
      } else {
        console.log(`Column ${col}: EXISTS`);
      }
    } catch (e) {
      console.log(`Column ${col}: EXCEPTION - ${e}`);
    }
  }
  
  // Try to insert with logo_url
  console.log('\n--- Testing insert with logo_url ---');
  const { data: insertData, error: insertError } = await supabase
    .from('projects')
    .upsert({
      wallet_address: '0xtest' + Date.now(),
      name: 'test project',
      logo_url: 'https://example.com/logo.png',
      link: 'https://example.com',
      profile_data: { description: 'test', twitter: 'test', telegram: 'test', discord: 'test' }
    })
    .select();
  
  if (insertError) {
    console.error('Insert with logo_url failed:', insertError.message);
    console.error('Details:', insertError);
  } else {
    console.log('Insert with logo_url succeeded!');
    console.log('Data:', insertData);
  }
}

main().catch(console.error);
