process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/capsule', () => ({
  create: jest.fn(),
}));

const Capsule = require('../models/capsule');
const app = require('../app');

describe('Capsule create route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/capsules creates capsule', async () => {
    const token = jwt.sign({ id: '507f191e810c19729de860ea' }, process.env.JWT_SECRET);
    const created = { _id: '507f191e810c19729de860ec', title: 'My title' };
    Capsule.create.mockResolvedValue(created);

    const response = await request(app)
      .post('/api/capsules')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My title' });

    expect(response.status).toBe(201);
    expect(Capsule.create).toHaveBeenCalled();
    expect(response.body._id).toBe(created._id);
  });

  test('POST /api/capsules missing title returns 400', async () => {
    const token = jwt.sign({ id: '507f191e810c19729de860ea' }, process.env.JWT_SECRET);

    const response = await request(app)
      .post('/api/capsules')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
  });
});
