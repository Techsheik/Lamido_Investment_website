import { createClient } from '@supabase/supabase-js';

export default async function getSignedUrlHandler(req, res) {
  try {
    const { file_path } = req.body || {};
    if (!file_path) return res.status(400).json({ error: 'file_path is required' });

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase service key not configured on server' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.storage
      .from('transaction-proofs')
      .createSignedUrl(file_path, 60);

    if (error) {
      console.error('Signed URL error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create signed URL', details: error });
    }

    return res.status(200).json({ signedUrl: data?.signedUrl });
  } catch (err) {
    console.error('getSignedUrlHandler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
