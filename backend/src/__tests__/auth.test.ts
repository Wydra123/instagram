import request from 'supertest';
import { app } from '../app';
import { setupDB, teardownDB, clearDB } from './setup';

beforeAll(setupDB);
afterEach(clearDB);
afterAll(teardownDB);

const validUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
};

async function register(data = validUser) {
  return request(app).post('/api/auth/register').send(data);
}

describe('POST /api/auth/register', () => {
  it('tworzy użytkownika i zwraca token (201)', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ username: 'testuser', email: 'test@example.com' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('zwraca 400 gdy brakuje pól', async () => {
    const res = await register({ username: 'only', email: '', password: '' });
    expect(res.status).toBe(400);
  });

  it('zwraca 400 gdy hasło jest za krótkie (< 6 znaków)', async () => {
    const res = await register({ ...validUser, password: '123' });
    expect(res.status).toBe(400);
  });

  it('zwraca 409 gdy email jest już zajęty', async () => {
    await register();
    const res = await register({ username: 'otheruser', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('zwraca 409 gdy nazwa użytkownika jest już zajęta', async () => {
    await register();
    const res = await register({ username: 'testuser', email: 'other@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => register());

  it('zwraca token przy prawidłowych danych (200)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ username: 'testuser' });
  });

  it('zwraca 401 przy złym haśle', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('zwraca 400 gdy brakuje pól', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email });
    expect(res.status).toBe(400);
  });

  it('zwraca 401 gdy użytkownik nie istnieje', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('zawsze zwraca 200', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

describe('GET /health', () => {
  it('zwraca status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
