const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Rutas
app.use('/api/capsules', require('./routes/capsuleRoutes'));
app.use('/api/users', require('./routes/authRoutes'));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;