require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Verificar que la variable de entorno se está leyendo
console.log("MONGO_URI =", process.env.MONGO_URI);

// Conexión a MongoDB Atlas (sin opciones obsoletas)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🔥 MongoDB conectado correctamente"))
  .catch(err => console.error("❌ Error conectando a MongoDB:", err));

// Rutas
app.use('/api/capsules', require('./routes/capsuleRoutes'));
app.use('/api/users', require('./routes/authRoutes'));

// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));