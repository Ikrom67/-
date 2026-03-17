const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.has(normalizedEmail)) {
      return res.status(409).json({ error: 'Email allaqachon ro‘yxatga olingan' });
    }
    const hashed = await bcrypt.hash(password, 10);
    users.set(normalizedEmail, { name: String(name).trim(), email: normalizedEmail, password: hashed });
    return res.json({ message: 'Ro‘yxatdan o‘tish muvaffaqiyatli.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email va password kerak' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
    }
    return res.json({ message: 'Kirish muvaffaqiyatli', user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
