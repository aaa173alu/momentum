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

describe('Capsule 3D media routes', () => {
  const capsuleId = '507f191e810c19729de860ec';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/capsules/:id/media accepts 3d media item with metadata', async () => {
    const userId = '507f191e810c19729de860ea';
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

    const mediaItems = { push: jest.fn() };
    const capsule = {
      _id: capsuleId,
      owner: userId,
      collaborators: [],
      mediaItems,
      save: jest.fn().mockResolvedValue(undefined),
    };

    Capsule.findById.mockResolvedValue(capsule);

    const response = await request(app)
      .post(`/api/capsules/${capsuleId}/media`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: '/uploads/model.glb',
        type: '3d',
        modelFormat: 'glb',
        fileSize: 12345,
        title: 'Modelo 3D',
      });

    expect(response.status).toBe(201);
    expect(mediaItems.push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '3d',
        url: '/uploads/model.glb',
        modelFormat: 'glb',
        fileSize: 12345,
      }),
    );
    expect(capsule.save).toHaveBeenCalled();
  });

  test('GET /api/capsules/:id/model3d returns primary 3d media item', async () => {
    const userId = '507f191e810c19729de860ea';
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

    Capsule.findOne.mockResolvedValue({
      _id: capsuleId,
      owner: userId,
      sharedWith: [],
      collaborators: [],
      mediaItems: [
        {
          _id: '507f191e810c19729de860ed',
          type: '3d',
          url: '/uploads/model.glb',
          modelFormat: 'glb',
          fileSize: 90876,
          thumbnailUrl: '/uploads/model-thumb.png',
        },
      ],
    });

    const response = await request(app)
      .get(`/api/capsules/${capsuleId}/model3d`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        capsuleId,
        type: '3d',
        url: '/uploads/model.glb',
        modelFormat: 'glb',
        fileSize: 90876,
        thumbnailUrl: '/uploads/model-thumb.png',
      }),
    );
  });

  test('GET /api/capsules/:id/model3d falls back to extension match when type is not 3d', async () => {
    const userId = '507f191e810c19729de860ea';
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

    Capsule.findOne.mockResolvedValue({
      _id: capsuleId,
      owner: userId,
      sharedWith: [],
      collaborators: [],
      mediaItems: [
        {
          _id: '507f191e810c19729de860ef',
          type: 'file',
          url: '/uploads/legacy-model.gltf',
          modelFormat: 'gltf',
        },
      ],
    });

    const response = await request(app)
      .get(`/api/capsules/${capsuleId}/model3d`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.url).toBe('/uploads/legacy-model.gltf');
    expect(response.body.modelFormat).toBe('gltf');
  });
});
