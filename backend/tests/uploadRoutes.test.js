process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
  const mockJwt = require('jsonwebtoken');
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token' });
  }

  try {
    req.user = mockJwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

const app = require('../app');

describe('Upload routes', () => {
  const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  beforeEach(() => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(uploadsDir)) {
      fs.readdirSync(uploadsDir).forEach((file) => {
        fs.unlinkSync(path.join(uploadsDir, file));
      });
    }
  });

  test('POST /api/uploads/media uploads a file and returns url', async () => {
    const response = await request(app)
      .post('/api/uploads/media')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), 'sample.txt');

    expect(response.status).toBe(201);
    expect(response.body.fileUrl).toMatch(/^\/uploads\//);
    expect(response.body.originalName).toBe('sample.txt');
    expect(response.body.type).toBeDefined();
  });

  test('POST /api/uploads/media requires file', async () => {
    const response = await request(app)
      .post('/api/uploads/media')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('File is required');
  });
});
