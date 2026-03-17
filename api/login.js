const bcrypt = require('bcryptjs');
const { users } = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { email, password } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'email va password kerak' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.get(normalizedEmail);
    if (!user) {
      res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
      return;
    }
    res.status(200).json({ message: 'Kirish muvaffaqiyatli', user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi' });
  }
};
