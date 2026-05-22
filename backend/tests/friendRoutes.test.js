process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/user', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../models/friendRelation', () => {
  const FriendRelation = jest.fn().mockImplementation(function FriendRelation(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
    return this;
  });

  FriendRelation.findOne = jest.fn();
  FriendRelation.findById = jest.fn();
  FriendRelation.find = jest.fn();
  FriendRelation.create = jest.fn();
  FriendRelation.findByIdAndDelete = jest.fn();

  return FriendRelation;
});

jest.mock('../models/notification', () => ({
  create: jest.fn().mockResolvedValue({
    _id: '507f191e810c19729de860ed',
    recipient: '507f191e810c19729de860eb',
    actor: '507f191e810c19729de860ea',
    type: 'friend_accepted',
    read: false,
  }),
}));

const User = require('../models/user');
const FriendRelation = require('../models/friendRelation');
const app = require('../app');

describe('Friend routes', () => {
  const userA = '507f191e810c19729de860ea';
  const userB = '507f191e810c19729de860eb';
  const relationId = '507f191e810c19729de860ec';

  function makePopulatedRelation(overrides = {}) {
    const relation = {
      _id: relationId,
      requester: { _id: userA, name: 'Alice' },
      recipient: { _id: userB, name: 'Bob' },
      status: 'pending',
      blockedBy: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides,
    };

    relation.populate = jest.fn().mockReturnValue(relation);
    return relation;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    FriendRelation.findById.mockImplementation(() => makePopulatedRelation());
  });

  test('POST /api/friends/requests creates a pending request', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);

    User.findById.mockResolvedValue({ _id: userB, name: 'Bob' });
    FriendRelation.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/friends/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: userB });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Friend request sent');
  });

  test('POST /api/friends/requests/:id/accept accepts incoming request', async () => {
    const token = jwt.sign({ id: userB }, process.env.JWT_SECRET);

    const relation = {
      _id: relationId,
      requester: userA,
      recipient: userB,
      status: 'pending',
      save: jest.fn().mockResolvedValue(undefined),
    };

    FriendRelation.findById.mockResolvedValueOnce(relation);

    const response = await request(app)
      .post(`/api/friends/requests/${relationId}/accept`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Friend request accepted');
    expect(relation.save).toHaveBeenCalled();
  });

  test('DELETE /api/friends/:userId removes accepted friend', async () => {
    const token = jwt.sign({ id: userA }, process.env.JWT_SECRET);

    FriendRelation.findOne.mockResolvedValue({
      _id: relationId,
      requester: userA,
      recipient: userB,
      status: 'accepted',
    });
    FriendRelation.findByIdAndDelete.mockResolvedValue({ _id: 'r1' });

    const response = await request(app)
      .delete(`/api/friends/${userB}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Friend removed');
  });

  test('POST /api/friends/block blocks user', async () => {
    const token = jwt.sign({ id: userA }, process.env.JWT_SECRET);

    User.findById.mockResolvedValue({ _id: userB, name: 'Bob' });
    FriendRelation.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/friends/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: userB });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('User blocked');
  });
});
