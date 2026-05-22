const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const frontendUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || 'https://momentum-frontend-xjzj.onrender.com').replace(/\/$/, '');
const allowedOrigins = new Set([
  frontendUrl,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || /^http:\/\/localhost(?::\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
}));
app.use(express.json({ limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/3d', express.static(path.join(__dirname, '../frontend/public/3d')));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Rutas
app.use('/api/capsules', require('./routes/capsuleRoutes'));
app.use('/api/users', require('./routes/authRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api/friends', require('./routes/friendRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/invite', require('./routes/inviteRoutes'));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload too large' });
  }

  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
