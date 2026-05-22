const fs = require('fs');
require('dotenv').config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });
const mongoose = require('mongoose');
const app = require('./app');

mongoose.set('bufferCommands', false);

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('🔥 MongoDB conectado correctamente'))
  .catch((err) => console.error('❌ Error conectando a MongoDB:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));