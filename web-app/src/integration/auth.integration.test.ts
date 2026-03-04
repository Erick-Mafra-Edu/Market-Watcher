import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const asQueryResponse = (rows: Array<Record<string, unknown>>, rowCount?: number): unknown => {
  return {
    command: 'SELECT',
    rowCount: rowCount ?? rows.length,
    oid: 0,
    rows,
    fields: [],
  };
};

describe('Auth integration', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should register user via HTTP route', async () => {
    const { AuthController } = await import('../controllers/auth.controller');

    const pool = new Pool();
    const querySpy = jest.spyOn(pool, 'query');

    querySpy
      .mockResolvedValueOnce(asQueryResponse([]) as never)
      .mockResolvedValueOnce(
        asQueryResponse([{ id: 1, email: 'user@test.com', name: 'User Teste' }]) as never
      );

    const app = express();
    app.use(express.json());

    const controller = new AuthController(pool);
    app.post('/api/auth/register', (req, res) => controller.register(req, res));

    const response = await request(app).post('/api/auth/register').send({
      email: 'user@test.com',
      password: '123456',
      name: 'User Teste',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('user@test.com');
    expect(typeof response.body.token).toBe('string');

    querySpy.mockRestore();
    await pool.end();
  });

  it('should login user via HTTP route', async () => {
    const { AuthController } = await import('../controllers/auth.controller');

    const pool = new Pool();
    const querySpy = jest.spyOn(pool, 'query');
    const passwordHash = await bcrypt.hash('123456', 10);

    querySpy.mockResolvedValueOnce(
      asQueryResponse([
        { id: 2, email: 'login@test.com', password_hash: passwordHash, name: 'Login User' },
      ]) as never
    );

    const app = express();
    app.use(express.json());

    const controller = new AuthController(pool);
    app.post('/api/auth/login', (req, res) => controller.login(req, res));

    const response = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: '123456',
    });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('login@test.com');
    expect(typeof response.body.token).toBe('string');

    querySpy.mockRestore();
    await pool.end();
  });
});
