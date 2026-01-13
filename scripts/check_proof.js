import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env from project root
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    let key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
} else {
  console.error('.env not found');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const arg = process.argv[2];
  const filePath = arg || '269d5e37-70a3-4b87-8f06-430969dec34b/1768154811014-Screenshot_2025-08-18-20-28-59-971_com.whatsapp.jpg';

  console.log('Checking file path:', filePath);

  // Query DB for matching proof row
  try {
    const { data: rows, error: qErr } = await supabase
      .from('transaction_proofs')
      .select('*')
      .eq('file_path', filePath)
      .limit(5);

    if (qErr) {
      console.error('DB query error:', qErr);
    } else {
      console.log('DB rows matching file_path:', rows);
    }
  } catch (e) {
    console.error('DB query failed', e);
  }

  // List directory
  const parts = filePath.split('/');
  const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const fileName = parts[parts.length - 1];
  console.log('Listing dir:', dir || '(root)');
  try {
    const { data: listData, error: listError } = await supabase.storage
      .from('transaction-proofs')
      .list(dir || '', { limit: 100 });

    if (listError) {
      console.error('Storage list error:', listError);
    } else {
      console.log('Storage list length:', Array.isArray(listData) ? listData.length : listData);
      const found = Array.isArray(listData) && listData.find(f => f.name === fileName);
      console.log('Found file in storage list?', !!found);
      if (found) console.log('Found entry:', found);
    }
  } catch (e) {
    console.error('Storage list failed', e);
  }

  // Try createSignedUrl
  try {
    const { data, error } = await supabase.storage
      .from('transaction-proofs')
      .createSignedUrl(filePath, 60);
    if (error) {
      console.error('createSignedUrl error:', error);
    } else {
      console.log('Signed URL (preview):', data?.signedUrl);
    }
  } catch (e) {
    console.error('createSignedUrl failed', e);
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
