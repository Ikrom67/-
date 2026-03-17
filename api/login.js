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

  const { email, password } = body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'email va password kerak' });
    return;
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id, name, email, password')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('Supabase query error', queryError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
    }

    return res.status(200).json({ message: 'Kirish muvaffaqiyatli', user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
};
