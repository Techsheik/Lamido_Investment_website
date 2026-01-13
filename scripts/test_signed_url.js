import fetch from 'node-fetch';

const filePath = process.argv[2] || '269d5e37-70a3-4b87-8f06-430969dec34b/1768154811014-Screenshot_2025-08-18-20-28-59-971_com.whatsapp.jpg';
const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = process.env.API_PORT || '3000';
const API_URL = `http://${API_HOST}:${API_PORT}/api/admin/get-signed-url`;

async function run(){
  try{
    console.log('Posting to', API_URL, 'for', filePath);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  }catch(err){
    console.error('Request error:', err);
  }
}

run();
