require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

mongoose.set('bufferCommands', false);

// Conexión a MongoDB Atlas (sin opciones obsoletas)
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("🔥 MongoDB conectado correctamente"))
  .catch(err => console.error("❌ Error conectando a MongoDB:", err));

// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));