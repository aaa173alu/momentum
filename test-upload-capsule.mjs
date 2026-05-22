import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

const API_URL = 'http://localhost:5000';

async function post(endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    const client = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };
    const req = client.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function postForm(endpoint, file, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    const fileContent = fs.readFileSync(file);
    const fileName = path.basename(file);
    const boundary = '----FormBoundary' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const client = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = client.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log('1. Logging in...');
    const loginRes = await post('/api/users/login', { email: 'ejemplo@gmail.com', password: '12345678' });
    if (loginRes.status !== 200) {
      console.error('Login failed:', loginRes);
      return;
    }
    const token = loginRes.body.token;
    console.log('✓ Logged in, token:', token.slice(0, 20) + '...');

    console.log('2. Uploading files...');
    const baseDir = 'frontend/test-uploads';
    const files = [
      { path: `${baseDir}/demo.png`, name: 'demo.png' },
      { path: `${baseDir}/sample.mp4`, name: 'sample.mp4' },
      { path: `${baseDir}/sample.mp3`, name: 'sample.mp3' },
    ];

    const uploads = [];
    for (const file of files) {
      const res = await postForm('/api/uploads/media', file.path, token);
      if (res.status === 201 || res.status === 200) {
        console.log(`✓ Uploaded ${file.name}:`, res.body.type);
        uploads.push(res.body);
      } else {
        console.error(`✗ Failed to upload ${file.name}:`, res);
      }
    }

    console.log('3. Creating capsule...');
    const mediaItems = uploads.map(u => ({
      type: u.type,
      url: u.fileUrl,
      modelFormat: u.modelFormat || '',
      fileSize: u.size || 0,
      title: u.originalName || u.fileName || '',
      description: '',
      thumbnailUrl: u.thumbnailUrl || '',
    }));

    const capsulePayload = {
      title: 'Prueba multimedia - imagen, video, audio',
      description: 'Cápsula de prueba con múltiples tipos de contenido multimedia',
      category: 'test',
      design: { key: 'default', label: 'Default' },
      timeCapsule: { enabled: false, unlockAt: null },
      mediaItems,
    };

    const createRes = await post('/api/capsules', capsulePayload, token);
    if (createRes.status !== 201 && createRes.status !== 200) {
      console.error('Create capsule failed:', createRes);
      return;
    }

    const capsule = createRes.body;
    console.log('✓ Capsule created!');
    console.log('  ID:', capsule._id);
    console.log('  Title:', capsule.title);
    console.log('  Media items:', capsule.mediaItems?.length || 0);
    console.log('\n📦 Open capsule at: http://localhost:5174/capsula/' + capsule._id);

    // Save ID to file for browser to open
    fs.writeFileSync('capsule_id.txt', capsule._id);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
