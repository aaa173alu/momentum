require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

mongoose.set('bufferCommands', false);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Conexión a MongoDB Atlas (sin opciones obsoletas)
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("🔥 MongoDB conectado correctamente"))
  .catch(err => console.error("❌ Error conectando a MongoDB:", err));

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

// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));