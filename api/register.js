const bcrypt = require('bcryptjs');
const { users } = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { name, email, password } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email, password required' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.has(normalizedEmail)) {
      res.status(409).json({ error: 'Email allaqachon ro‘yxatga olingan' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    users.set(normalizedEmail, { name: String(name).trim(), email: normalizedEmail, password: hashed });
    res.status(200).json({ message: 'Ro‘yxatdan o‘tish muvaffaqiyatli.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi' });
  }
};
