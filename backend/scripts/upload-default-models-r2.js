/**
 * Sube los modelos 3D por defecto a Cloudflare R2 y actualiza capsuleRoutes.js.
 *
 * Requisitos:
 *   - .env con S3_3D_BUCKET, S3_3D_ENDPOINT, S3_3D_ACCESS_KEY, S3_3D_SECRET_KEY, S3_3D_PUBLIC_URL
 *   - GLB files en frontend/public/3d/
 *   - PNG thumbnails (mismo nombre que el GLB) en frontend/public/3d/  ← opcional pero recomendado
 *
 * Uso:
 *   node scripts/upload-default-models-r2.js
 *
 * Para regenerar solo los thumbnails sin re-subir los GLB:
 *   node scripts/upload-default-models-r2.js --thumbs-only
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.S3_3D_BUCKET;
const PUBLIC_URL = (process.env.S3_3D_PUBLIC_URL || '').replace(/\/$/, '');

if (!BUCKET || !PUBLIC_URL) {
  console.error('ERROR: S3_3D_BUCKET y S3_3D_PUBLIC_URL deben estar en el .env');
  process.exit(1);
}

const client = new S3Client({
  region: process.env.S3_3D_REGION || 'auto',
  endpoint: process.env.S3_3D_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_3D_ACCESS_KEY,
    secretAccessKey: process.env.S3_3D_SECRET_KEY,
  },
});

const MODELS_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', '3d');
const ROUTES_FILE = path.join(__dirname, '..', 'routes', 'capsuleRoutes.js');
const THUMBS_ONLY = process.argv.includes('--thumbs-only');

async function upload(localPath, key, contentType) {
  const body = fs.readFileSync(localPath);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${PUBLIC_URL}/${key}`;
}

function toTitleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildSvgThumb(label) {
  const safe = String(label).replace(/[<>&"]/g, '').slice(0, 20);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#17324d"/>
    <stop offset="100%" stop-color="#0f1d2d"/>
  </linearGradient></defs>
  <rect width="200" height="200" rx="20" fill="url(#g)"/>
  <rect x="40" y="40" width="120" height="120" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="3"/>
  <text x="100" y="108" fill="#fff" font-family="Arial,sans-serif" font-size="28" text-anchor="middle" font-weight="700">3D</text>
  <text x="100" y="135" fill="#fff" fill-opacity="0.75" font-family="Arial,sans-serif" font-size="13" text-anchor="middle">${safe}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function parseExistingModels(src) {
  const routeStart = src.indexOf("router.get('/models', auth");
  if (routeStart === -1) return [];

  const tryStart = src.indexOf('  try {', routeStart);
  const resJsonEnd = src.indexOf('res.json(models);', tryStart);
  if (tryStart === -1 || resJsonEnd === -1) return [];

  const block = src.slice(tryStart, resJsonEnd);
  const models = [];
  const entryRegex = /\{\s*id:\s*'([^']+)',\s*nombre:\s*'([^']+)',\s*thumbnailUrl:\s*'([^']*)',\s*modelUrl:\s*'([^']+)',?\s*\}/g;
  let match;
  while ((match = entryRegex.exec(block)) !== null) {
    models.push({ id: match[1], nombre: match[2], thumbUrl: match[3], glbUrl: match[4] });
  }
  return models;
}

async function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    console.error('ERROR: No existe la carpeta', MODELS_DIR);
    process.exit(1);
  }

  const glbFiles = fs.readdirSync(MODELS_DIR).filter(f => f.toLowerCase().endsWith('.glb'));
  if (glbFiles.length === 0) {
    console.error('ERROR: No hay archivos .glb en', MODELS_DIR);
    process.exit(1);
  }

  console.log(`Encontrados ${glbFiles.length} modelos: ${glbFiles.join(', ')}\n`);

  const results = [];

  for (const file of glbFiles) {
    const baseName = path.basename(file, path.extname(file));
    const nombre = toTitleCase(baseName);

    let glbUrl;
    if (THUMBS_ONLY) {
      glbUrl = `${PUBLIC_URL}/defaults/models/${file}`;
      console.log(`[skip GLB] ${file} → ${glbUrl}`);
    } else {
      process.stdout.write(`Subiendo GLB: ${file} ... `);
      glbUrl = await upload(
        path.join(MODELS_DIR, file),
        `defaults/models/${file}`,
        'model/gltf-binary',
      );
      console.log('✓');
    }

    // Thumbnail: busca PNG con el mismo nombre
    const pngPath = path.join(MODELS_DIR, `${baseName}.png`);
    let thumbUrl = '';
    if (fs.existsSync(pngPath)) {
      process.stdout.write(`Subiendo thumbnail: ${baseName}.png ... `);
      thumbUrl = await upload(pngPath, `defaults/thumbnails/${baseName}.png`, 'image/png');
      console.log('✓');
    } else {
      console.log(`  ⚠ Sin PNG para "${baseName}" — se usará SVG placeholder`);
      console.log(`    (genera la miniatura con scripts/gen-thumbnails.html y guárdala como ${baseName}.png)`);
    }

    results.push({ id: `model-${baseName}`, nombre, glbUrl, thumbUrl });
  }

  // Merge: mantener modelos existentes y añadir/actualizar los nuevos
  let src = fs.readFileSync(ROUTES_FILE, 'utf8');
  const existingModels = parseExistingModels(src);
  const mergedById = new Map(existingModels.map(m => [m.id, m]));
  for (const r of results) {
    mergedById.set(r.id, r);
  }
  const merged = Array.from(mergedById.values());

  // Construye el bloque de código actualizado
  const modelsBlock = merged.map(r => {
    const thumbValue = r.thumbUrl
      ? `'${r.thumbUrl}'`
      : `buildModelThumbnailDataUrl('${r.nombre}')`;
    return [
      '      {',
      `        id: '${r.id}',`,
      `        nombre: '${r.nombre}',`,
      `        thumbnailUrl: ${thumbValue},`,
      `        modelUrl: '${r.glbUrl}',`,
      '      },',
    ].join('\n');
  }).join('\n');

  const newBlock =
    '  try {\n' +
    '    const models = [\n' +
    modelsBlock + '\n' +
    '    ];\n\n' +
    '    res.json(models);';

  // Actualiza capsuleRoutes.js
  const routeStart = src.indexOf("router.get('/models', auth");
  if (routeStart === -1) {
    console.error('\nERROR: No se encontró router.get(\'/models\') en capsuleRoutes.js');
    console.log('\nPega este bloque manualmente en la ruta GET /models:\n');
    console.log(newBlock);
    process.exit(1);
  }

  // Reemplaza el bloque try { const models = [...] hasta res.json(models);
  const tryStart = src.indexOf('  try {', routeStart);
  const resJsonEnd = src.indexOf('res.json(models);', tryStart) + 'res.json(models);'.length;

  if (tryStart === -1 || resJsonEnd === -1) {
    console.error('\nERROR: No se pudo localizar el bloque a reemplazar automáticamente.');
    console.log('\nPega este bloque manualmente:\n');
    console.log(newBlock);
    process.exit(1);
  }

  const updated = src.slice(0, tryStart) + newBlock + src.slice(resJsonEnd);

  // Elimina también los THUMB_* y makeThumb que ya no hacen falta si todos tienen PNG
  const allHavePng = merged.every(r => r.thumbUrl);
  if (allHavePng) {
    const thumbsClean = updated
      .replace(/\nfunction makeThumb[\s\S]*?\n\}\n/, '\n')
      .replace(/\nconst THUMB_[A-Z_]+ = makeThumb\([\s\S]*?\);\n/g, '\n');
    fs.writeFileSync(ROUTES_FILE, thumbsClean, 'utf8');
    console.log('\n✓ capsuleRoutes.js actualizado (makeThumb y THUMB_* eliminados)');
  } else {
    fs.writeFileSync(ROUTES_FILE, updated, 'utf8');
    console.log('\n✓ capsuleRoutes.js actualizado');
  }

  console.log('\nURLs subidas:');
  for (const r of results) {
    console.log(`  ${r.nombre}:`);
    console.log(`    GLB:   ${r.glbUrl}`);
    if (r.thumbUrl) console.log(`    Thumb: ${r.thumbUrl}`);
  }
}

main().catch(err => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
