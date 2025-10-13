const request = require('supertest');
const app = require('../server');

describe('Authentication', () => {
  test('POST /api/auth/login - should require email and password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({});
    
    expect(response.status).toBe(400);
  });

  test('POST /api/auth/login - should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'invalid@test.com',
        password: 'wrongpassword'
      });
    
    expect(response.status).toBe(401);
  });
});

describe('Protected Routes', () => {
  test('GET /api/dashboard/data - should require authentication', async () => {
    const response = await request(app)
      .get('/api/dashboard/data');
    
    expect(response.status).toBe(401);
  });
});