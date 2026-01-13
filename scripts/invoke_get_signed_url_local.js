import getSigned from '../api-lib/admin/get-signed-url.js';

async function run() {
  const req = { body: { file_path: '269d5e37-70a3-4b87-8f06-430969dec34b/1768154811014-Screenshot_2025-08-18-20-28-59-971_com.whatsapp.jpg' } };
  let result = null;
  const res = {
    status(code) { this._status = code; return this; },
    json(obj) { result = { status: this._status || 200, body: obj }; }
  };

  try {
    await getSigned(req, res);
    console.log('Handler result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Handler threw:', err);
  }
}

run();
