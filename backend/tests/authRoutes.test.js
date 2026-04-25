process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../models/user', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/refreshToken', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn(),
}));

const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const app = require('../app');

describe('Auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RefreshToken.deleteMany.mockResolvedValue({ deletedCount: 0 });
    RefreshToken.updateMany.mockResolvedValue({ acknowledged: true });
  });

  test('GET /api/users/preferences/options returns catalog', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);

    const response = await request(app)
      .get('/api/users/preferences/options')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.theme).toContain('light');
    expect(response.body.theme).toContain('dark');
    expect(response.body.defaults).toBeDefined();
  });

  test('POST /api/users/register validates input', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send({ name: '', email: 'bad-email', password: '123' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  test('POST /api/users/register creates user', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      profilePhoto: '',
      avatar: '',
      preferences: {
        theme: 'light',
        language: 'es',
        textSize: 'normal',
        reduceAnimations: false,
        emphasizeFocus: false,
        easyReadMode: false,
      },
      createdAt: new Date(),
    });

    const response = await request(app)
      .post('/api/users/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: '12345678' });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('ana@example.com');
    expect(response.body.profilePhoto).toBeDefined();
  });

  test('PATCH /api/users/me/preferences updates preferences', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);

    const save = jest.fn().mockResolvedValue(undefined);

    User.findById.mockResolvedValue({
      _id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      profilePhoto: '',
      avatar: '',
      preferences: {
        theme: 'light',
        language: 'es',
        textSize: 'normal',
        reduceAnimations: false,
        emphasizeFocus: false,
        easyReadMode: false,
      },
      createdAt: new Date(),
      save,
    });

    const response = await request(app)
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', textSize: 'large', reduceAnimations: true });

    expect(response.status).toBe(200);
    expect(response.body.preferences.theme).toBe('dark');
    expect(response.body.preferences.textSize).toBe('large');
    expect(response.body.preferences.reduceAnimations).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  test('PATCH /api/users/me/password rejects wrong current password', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);

    User.findById.mockResolvedValue({
      _id: 'u1',
      password: '$2b$10$JYn1UrVYf4W5f9Gg8xKd8eQ5R9oSB5fZsQJz2s4qS8E/f5S6Czd8K', // hash for unrelated password
      save: jest.fn(),
    });

    const response = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong1234', newPassword: '12345678' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Current password is invalid');
  });

  test('POST /api/users/login returns access and refresh token', async () => {
    const hashed = await bcrypt.hash('12345678', 10);

    User.findOne.mockResolvedValue({
      _id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      password: hashed,
      profilePhoto: '',
      avatar: '',
      preferences: {
        theme: 'light',
        language: 'es',
        textSize: 'normal',
        reduceAnimations: false,
        emphasizeFocus: false,
        easyReadMode: false,
      },
      createdAt: new Date(),
    });

    RefreshToken.create.mockResolvedValue({ _id: 'rt1' });

    const response = await request(app)
      .post('/api/users/login')
      .send({ email: 'ana@example.com', password: '12345678' });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.token).toBeDefined();
    expect(RefreshToken.deleteMany).toHaveBeenCalled();
    expect(RefreshToken.create).toHaveBeenCalled();
  });

  test('POST /api/users/refresh rotates refresh token', async () => {
    const oldTokenDoc = {
      user: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      save: jest.fn().mockResolvedValue(undefined),
    };

    RefreshToken.findOne.mockResolvedValue(oldTokenDoc);
    RefreshToken.create.mockResolvedValue({ _id: 'rt2' });

    User.findById.mockResolvedValue({
      _id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      profilePhoto: '',
      avatar: '',
      preferences: {
        language: 'es',
        textSize: 'normal',
        reduceAnimations: false,
        emphasizeFocus: false,
        easyReadMode: false,
      },
      createdAt: new Date(),
    });

    const response = await request(app)
      .post('/api/users/refresh')
      .send({ refreshToken: 'refresh-token-plain-value' });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(RefreshToken.deleteMany).toHaveBeenCalled();
    expect(oldTokenDoc.save).toHaveBeenCalled();
    expect(RefreshToken.create).toHaveBeenCalled();
  });

  test('POST /api/users/logout revokes refresh sessions', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);

    RefreshToken.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const response = await request(app)
      .post('/api/users/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logged out');
    expect(RefreshToken.updateMany).toHaveBeenCalled();
  });

  test('GET /api/users/sessions lists active sessions', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);

    RefreshToken.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        {
          _id: '507f191e810c19729de860ea',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          revokedAt: null,
          createdByIp: '127.0.0.1',
          userAgent: 'jest',
        },
      ]),
    });

    const response = await request(app)
      .get('/api/users/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]._id).toBeDefined();
  });

  test('DELETE /api/users/sessions/:id revokes one session', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
    RefreshToken.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const response = await request(app)
      .delete('/api/users/sessions/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Session revoked');
    expect(RefreshToken.updateOne).toHaveBeenCalled();
  });
});
