const bcrypt = require('bcryptjs');
const supabase = require('./supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (error) {
    body = {};
  }

  const { name, email, password } = body || {};
  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email, password required' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(name).trim();

  try {
    const { data: existing, error: queryError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('Supabase query error', queryError);
      return res.status(500).json({ error: 'Database error' });
    }
    if (existing) {
      return res.status(409).json({ error: 'Email allaqachon ro‘yxatga olingan' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ name: normalizedName, email: normalizedEmail, password: hashed }]);

    if (insertError) {
      console.error('Supabase insert error', insertError);
      return res.status(500).json({ error: 'Could not create user' });
    }

    res.status(200).json({ message: 'Ro‘yxatdan o‘tish muvaffaqiyatli.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi' });
  }
};
