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

const Capsule = require('../models/capsule');
const app = require('../app');

function makeComment(id, authorId, text) {
  return {
    _id: id,
    author: authorId,
    text,
    deleteOne: jest.fn(),
  };
}

function makeMedia(id, comments) {
  return {
    _id: id,
    comments: {
      id: (commentId) => comments.find((comment) => comment._id === commentId),
      toArray: () => comments,
    },
  };
}

function makeCapsule({ owner = '507f191e810c19729de860ea', mediaComments = [] } = {}) {
  const media = makeMedia('507f191e810c19729de860eb', mediaComments);
  const capsule = {
    _id: '507f191e810c19729de860ec',
    owner,
    sharedWith: [],
    collaborators: [],
    mediaItems: {
      id: (mediaId) => (mediaId === media._id ? media : null),
      map: (mapper) => [mediaComments].map(mapper),
    },
    save: jest.fn().mockResolvedValue(undefined),
    toObject: () => ({
      _id: '507f191e810c19729de860ec',
      owner,
      sharedWith: [],
      collaborators: [],
      mediaItems: [
        {
          _id: media._id,
          comments: mediaComments,
        },
      ],
    }),
  };

  return capsule;
}

describe('Capsule comment routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/capsules/:id can paginate comments', async () => {
    const token = jwt.sign({ id: '507f191e810c19729de860ea' }, process.env.JWT_SECRET);
    const comments = [
      makeComment('507f191e810c19729de860ed', 'u1', 'one'),
      makeComment('507f191e810c19729de860ee', 'u2', 'two'),
      makeComment('507f191e810c19729de860ef', 'u3', 'three'),
    ];
    const capsule = makeCapsule({ mediaComments: comments });

    const query = {
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(capsule),
    };
    Capsule.findOne.mockReturnValue(query);

    const response = await request(app)
      .get('/api/capsules/507f191e810c19729de860ec?commentsLimit=2&commentsOffset=1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.mediaItems[0].comments).toHaveLength(2);
    expect(response.body.mediaItems[0].commentsMeta.total).toBe(3);
    expect(response.body.mediaItems[0].commentsMeta.hasMore).toBe(false);
  });

  test('DELETE /api/capsules/:id/media/:mediaId/comments/:commentId lets capsule owner remove any comment', async () => {
    const token = jwt.sign({ id: '507f191e810c19729de860ea' }, process.env.JWT_SECRET);
    const comment = makeComment('507f191e810c19729de860ed', '507f191e810c19729de860ff', 'one');
    const capsule = makeCapsule({ owner: '507f191e810c19729de860ea', mediaComments: [comment] });

    Capsule.findOne.mockResolvedValue(capsule);
    Capsule.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
    });

    const response = await request(app)
      .delete('/api/capsules/507f191e810c19729de860ec/media/507f191e810c19729de860eb/comments/507f191e810c19729de860ed')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(comment.deleteOne).toHaveBeenCalled();
    expect(capsule.save).toHaveBeenCalled();
  });

  test('DELETE /api/capsules/:id/media/:mediaId/comments/:commentId rejects non author non admin', async () => {
    const token = jwt.sign({ id: '507f191e810c19729de860aa' }, process.env.JWT_SECRET);
    const comment = makeComment('507f191e810c19729de860ed', '507f191e810c19729de860ff', 'one');
    const capsule = makeCapsule({ owner: '507f191e810c19729de860ea', mediaComments: [comment] });

    Capsule.findOne.mockResolvedValue(capsule);

    const response = await request(app)
      .delete('/api/capsules/507f191e810c19729de860ec/media/507f191e810c19729de860eb/comments/507f191e810c19729de860ed')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });
});
