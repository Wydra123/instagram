import request from 'supertest';
import { app } from '../app';
import { setupDB, teardownDB, clearDB } from './setup';

beforeAll(setupDB);
afterEach(clearDB);
afterAll(teardownDB);

async function createUser(username: string, email: string) {
  const res = await request(app).post('/api/auth/register').send({
    username,
    email,
    password: 'password123',
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}

async function createPost(token: string, caption: string) {
  return request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .field('caption', caption);
}

describe('GET /api/posts', () => {
  it('zwraca tablicę postów (200)', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/posts/me', () => {
  it('zwraca 401 bez tokenu', async () => {
    const res = await request(app).get('/api/posts/me');
    expect(res.status).toBe(401);
  });

  it('zwraca posty zalogowanego użytkownika', async () => {
    const { token } = await createUser('postowner', 'owner@example.com');
    await createPost(token, 'Mój post');

    const res = await request(app).get('/api/posts/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('caption', 'Mój post');
  });
});

describe('GET /api/posts/user/:username', () => {
  it('zwraca 404 dla nieistniejącego użytkownika', async () => {
    const res = await request(app).get('/api/posts/user/nieistniejacy');
    expect(res.status).toBe(404);
  });

  it('zwraca posty danego użytkownika', async () => {
    const { token } = await createUser('postuser', 'postuser@example.com');
    await createPost(token, 'Post użytkownika');

    const res = await request(app).get('/api/posts/user/postuser');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/posts', () => {
  it('zwraca 401 bez tokenu', async () => {
    const res = await request(app).post('/api/posts').send({ caption: 'test' });
    expect(res.status).toBe(401);
  });

  it('zwraca 400 gdy post nie ma treści ani zdjęcia', async () => {
    const { token } = await createUser('emptypost', 'empty@example.com');
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .field('caption', '');
    expect(res.status).toBe(400);
  });

  it('tworzy post z podpisem (201)', async () => {
    const { token } = await createUser('newposter', 'newposter@example.com');
    const res = await createPost(token, 'Mój pierwszy post');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('caption', 'Mój pierwszy post');
    expect(res.body.author).toHaveProperty('username', 'newposter');
  });
});

describe('POST /api/posts/:id/like', () => {
  it('dodaje i usuwa like (toggle)', async () => {
    const { token } = await createUser('liker', 'liker@example.com');
    const postRes = await createPost(token, 'Polub mnie');
    const postId = postRes.body._id as string;

    const like = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(like.status).toBe(200);
    expect(like.body.likes).toHaveLength(1);

    const unlike = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(unlike.status).toBe(200);
    expect(unlike.body.likes).toHaveLength(0);
  });

  it('zwraca 401 bez tokenu', async () => {
    const { token } = await createUser('poster', 'poster@example.com');
    const postRes = await createPost(token, 'Post');
    const res = await request(app).post(`/api/posts/${postRes.body._id}/like`);
    expect(res.status).toBe(401);
  });

  it('zwraca 404 dla nieistniejącego posta', async () => {
    const { token } = await createUser('likerx', 'likerx@example.com');
    const res = await request(app)
      .post('/api/posts/000000000000000000000001/like')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/posts/:id/comments', () => {
  it('dodaje komentarz (201)', async () => {
    const { token } = await createUser('commenter', 'commenter@example.com');
    const postRes = await createPost(token, 'Skomentuj mnie');
    const postId = postRes.body._id as string;

    const res = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Świetny post!' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('text', 'Świetny post!');
  });

  it('zwraca 400 dla pustego komentarza', async () => {
    const { token } = await createUser('commenter2', 'commenter2@example.com');
    const postRes = await createPost(token, 'Post');
    const res = await request(app)
      .post(`/api/posts/${postRes.body._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/posts/:id', () => {
  it('usuwa własny post (200)', async () => {
    const { token } = await createUser('deleter', 'deleter@example.com');
    const postRes = await createPost(token, 'Usuń mnie');
    const postId = postRes.body._id as string;

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const check = await request(app).get('/api/posts');
    expect(check.body).toHaveLength(0);
  });

  it('zwraca 404 przy usuwaniu cudzego posta', async () => {
    const { token: token1 } = await createUser('owner1', 'owner1@example.com');
    const { token: token2 } = await createUser('hacker', 'hacker@example.com');

    const postRes = await createPost(token1, 'Nie twój post');
    const res = await request(app)
      .delete(`/api/posts/${postRes.body._id}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(404);
  });
});
