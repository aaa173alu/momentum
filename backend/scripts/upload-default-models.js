/**
 * Script para subir los modelos 3D por defecto a Cloudinary.
 *
 * Uso:
 *   cd backend
 *   node scripts/upload-default-models.js
 *
 * Para cada modelo puedes indicar una imagen thumbnail propia (PNG/JPG).
 * Si no se indica, se genera y sube automáticamente un placeholder.
 *
 * Al terminar imprime el array listo para pegar en capsuleRoutes.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key:    process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURA AQUÍ TUS MODELOS
// glbPath:       ruta absoluta o relativa al .glb (desde backend/)
// thumbnailPath: ruta a una imagen PNG/JPG, o null para generar placeholder
// ─────────────────────────────────────────────────────────────────────────────
const MODELS_TO_UPLOAD = [
  {
    id:            'microfono',
    nombre:        'Microfono',
    glbPath:       path.join(__dirname, '../uploads/metal+microphone+3d+model.glb'),
    thumbnailPath: null,                 // ← pon aquí la ruta a tu PNG si tienes uno
  },
  {
    id:            'caja-del-tesoro',
    nombre:        'Caja del Tesoro',
    glbPath:       path.join(__dirname, '../uploads/treasure chest 3d model.glb'),
    thumbnailPath: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

function buildSvgThumbnailBuffer(label) {
  const safe = String(label || '3D').replace(/[<>&"]/g, '').slice(0, 20);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#1a2e44"/>
      <stop offset="100%" stop-color="#0d1b2a"/>
    </linearGradient>
  </defs>
  <rect width="300" height="300" rx="24" fill="url(#bg)"/>
  <rect x="30" y="30" width="240" height="240" rx="18"
        fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
  <text x="150" y="140" fill="#ffffff" font-family="Arial,sans-serif"
        font-size="48" text-anchor="middle" font-weight="700">3D</text>
  <text x="150" y="180" fill="#aabbcc" font-family="Arial,sans-serif"
        font-size="20" text-anchor="middle">${safe}</text>
</svg>`;
  return Buffer.from(svg, 'utf-8');
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

async function main() {
  if (!process.env.CLOUDINARY_NAME) {
    console.error('ERROR: CLOUDINARY_NAME no está en el .env');
    process.exit(1);
  }

  const results = [];

  for (const model of MODELS_TO_UPLOAD) {
    console.log(`\n──────────────────────────────────────`);
    console.log(`Procesando: ${model.nombre} (${model.id})`);

    // 1. Subir el .glb como raw
    if (!fs.existsSync(model.glbPath)) {
      console.error(`  SKIP: no se encuentra el archivo ${model.glbPath}`);
      continue;
    }

    console.log(`  Subiendo GLB (esto puede tardar con archivos grandes)...`);
    const glbBuffer = fs.readFileSync(model.glbPath);
    const glbResult = await uploadBuffer(glbBuffer, {
      resource_type: 'raw',
      folder:        '3d-models/defaults',
      public_id:     model.id,
      overwrite:     true,
    });
    console.log(`  ✓ GLB subido: ${glbResult.secure_url}`);

    // 2. Subir o generar thumbnail
    let thumbnailUrl;

    if (model.thumbnailPath && fs.existsSync(model.thumbnailPath)) {
      console.log(`  Subiendo thumbnail personalizado...`);
      const thumbBuffer = fs.readFileSync(model.thumbnailPath);
      const thumbResult = await uploadBuffer(thumbBuffer, {
        resource_type:  'image',
        folder:         '3d-models/thumbnails',
        public_id:      `${model.id}-thumb`,
        overwrite:      true,
        transformation: [{ width: 400, height: 400, crop: 'pad', background: 'auto', quality: 80, format: 'jpg' }],
      });
      thumbnailUrl = thumbResult.secure_url;
    } else {
      console.log(`  Generando thumbnail SVG automático...`);
      const svgBuffer = buildSvgThumbnailBuffer(model.nombre);
      const thumbResult = await uploadBuffer(svgBuffer, {
        resource_type: 'image',
        folder:        '3d-models/thumbnails',
        public_id:     `${model.id}-thumb`,
        overwrite:     true,
        format:        'png',
      });
      thumbnailUrl = thumbResult.secure_url;
    }

    console.log(`  ✓ Thumbnail: ${thumbnailUrl}`);

    results.push({
      id:           model.id,
      nombre:       model.nombre,
      modelUrl:     glbResult.secure_url,
      thumbnailUrl,
    });
  }

  if (results.length === 0) {
    console.error('\nNo se subió ningún modelo. Revisa las rutas.');
    process.exit(1);
  }

  const output = JSON.stringify(results, null, 6);

  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  LISTO — pega esto en capsuleRoutes.js (router.get /models)  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`const models = ${output};\n`);

  // También lo guarda en un archivo para no perderlo
  const outFile = path.join(__dirname, 'models-output.json');
  fs.writeFileSync(outFile, output, 'utf-8');
  console.log(`(También guardado en ${outFile})\n`);
}

main().catch((err) => {
  console.error('\nError inesperado:', err.message || err);
  process.exit(1);
});
