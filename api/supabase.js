const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SECRET_KEY is not set. API routes may fail.');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SECRET_KEY || '');
module.exports = supabase;
