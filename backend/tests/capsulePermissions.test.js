process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/capsule', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/user', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
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

const Capsule = require('../models/capsule');
const app = require('../app');

describe('Capsule collaborator permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('edit collaborator can patch capsule core data', async () => {
    const token = jwt.sign({ id: 'u-edit' }, process.env.JWT_SECRET);

    const save = jest.fn().mockResolvedValue(undefined);
    Capsule.findById.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      owner: 'u-owner',
      collaborators: [{ user: 'u-edit', role: 'edit' }],
      title: 'Old',
      description: '',
      category: '',
      timeCapsule: { enabled: false, unlockAt: null },
      save,
    });

    const response = await request(app)
      .patch('/api/capsules/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New title' });

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalled();
  });

  test('edit collaborator cannot share capsule', async () => {
    const token = jwt.sign({ id: 'u-edit' }, process.env.JWT_SECRET);

    Capsule.findById.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      owner: 'u-owner',
      collaborators: [{ user: 'u-edit', role: 'edit' }],
    });

    const response = await request(app)
      .post('/api/capsules/507f191e810c19729de860ea/share')
      .set('Authorization', `Bearer ${token}`)
      .send({ emails: ['friend@example.com'], role: 'view' });

    expect(response.status).toBe(403);
  });

  test('admin collaborator can delete capsule', async () => {
    const token = jwt.sign({ id: 'u-admin' }, process.env.JWT_SECRET);

    Capsule.findById.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      owner: 'u-owner',
      collaborators: [{ user: 'u-admin', role: 'admin' }],
    });
    Capsule.findByIdAndDelete.mockResolvedValue({ _id: '507f191e810c19729de860ea' });

    const response = await request(app)
      .delete('/api/capsules/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Deleted');
    expect(Capsule.findByIdAndDelete).toHaveBeenCalled();
  });
});
