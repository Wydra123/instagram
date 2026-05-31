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

describe('GET /api/users/me', () => {
  it('zwraca 401 bez tokenu', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('zwraca profil zalogowanego użytkownika', async () => {
    const { token } = await createUser('meuser', 'me@example.com');
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'meuser');
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});

describe('GET /api/users/:username', () => {
  it('zwraca publiczny profil użytkownika', async () => {
    await createUser('publicuser', 'public@example.com');
    const res = await request(app).get('/api/users/publicuser');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'publicuser');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('email');
  });

  it('zwraca 404 dla nieistniejącego użytkownika', async () => {
    const res = await request(app).get('/api/users/nieistniejacy');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/users/search', () => {
  it('zwraca 401 bez tokenu', async () => {
    const res = await request(app).get('/api/users/search?q=test');
    expect(res.status).toBe(401);
  });

  it('zwraca pustą tablicę gdy brak query', async () => {
    const { token } = await createUser('searcher', 'searcher@example.com');
    const res = await request(app).get('/api/users/search').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('znajduje użytkowników po nazwie', async () => {
    const { token } = await createUser('searcher2', 'searcher2@example.com');
    await createUser('findme', 'findme@example.com');
    await createUser('alsohere', 'alsohere@example.com');

    const res = await request(app)
      .get('/api/users/search?q=find')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u: { username: string }) => u.username === 'findme')).toBe(true);
    expect(res.body.some((u: { username: string }) => u.username === 'alsohere')).toBe(false);
  });

  it('wyklucza aktualnego użytkownika z wyników', async () => {
    const { token } = await createUser('selfuser', 'self@example.com');
    const res = await request(app)
      .get('/api/users/search?q=self')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u: { username: string }) => u.username === 'selfuser')).toBe(false);
  });
});

describe('GET /api/users/suggestions', () => {
  it('zwraca 401 bez tokenu', async () => {
    const res = await request(app).get('/api/users/suggestions');
    expect(res.status).toBe(401);
  });

  it('zwraca użytkowników których jeszcze nie obserwuję', async () => {
    const { token } = await createUser('suggestor', 'suggestor@example.com');
    await createUser('stranger', 'stranger@example.com');

    const res = await request(app)
      .get('/api/users/suggestions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u: { username: string }) => u.username === 'stranger')).toBe(true);
    expect(res.body.some((u: { username: string }) => u.username === 'suggestor')).toBe(false);
  });
});

describe('PUT /api/users/me', () => {
  it('aktualizuje bio użytkownika', async () => {
    const { token } = await createUser('biouser', 'bio@example.com');
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Moje nowe bio' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bio', 'Moje nowe bio');
  });

  it('zwraca 400 gdy bio przekracza 150 znaków', async () => {
    const { token } = await createUser('biouser2', 'bio2@example.com');
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(151) });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/:id/follow', () => {
  it('obserwuje innego użytkownika', async () => {
    const { token: token1 } = await createUser('follower', 'follower@example.com');
    const { id: id2 } = await createUser('followee', 'followee@example.com');

    const res = await request(app)
      .post(`/api/users/${id2}/follow`)
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('following', true);
    expect(res.body).toHaveProperty('followersCount', 1);
  });

  it('przestaje obserwować przy drugim wywołaniu (toggle)', async () => {
    const { token: token1 } = await createUser('unfollower', 'unfollower@example.com');
    const { id: id2 } = await createUser('unfollowee', 'unfollowee@example.com');

    await request(app)
      .post(`/api/users/${id2}/follow`)
      .set('Authorization', `Bearer ${token1}`);
    const res = await request(app)
      .post(`/api/users/${id2}/follow`)
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('following', false);
    expect(res.body).toHaveProperty('followersCount', 0);
  });

  it('zwraca 400 przy próbie obserwowania siebie', async () => {
    const { token, id } = await createUser('narcissist', 'narc@example.com');
    const res = await request(app)
      .post(`/api/users/${id}/follow`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('zwraca 401 bez tokenu', async () => {
    const { id } = await createUser('target', 'target@example.com');
    const res = await request(app).post(`/api/users/${id}/follow`);
    expect(res.status).toBe(401);
  });
});
