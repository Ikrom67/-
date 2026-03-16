const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Статик файлларни 'public' папкасидан бериш
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', require('./api/index'));

// Асосий саҳифа учун (агар index.html public папкасида бўлса, бу сатр керак эмас)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Vercel учун экспорт (app.listen ўрнига)
module.exports = app;

