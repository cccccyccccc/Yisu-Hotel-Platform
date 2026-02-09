// tests/test_different_routes/health.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");

jest.setTimeout(30000);

describe('健康检查路由测试 (Health Routes)', () => {
  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_health';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 健康检查接口 (GET /api/health)
  // ==========================================
  describe('GET /api/health (健康检查)', () => {
    it('1.1 数据库连接正常时返回 healthy', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBeDefined();
      expect(res.body.database.status).toBe('connected');
      expect(res.body.memory).toBeDefined();
      expect(res.body.memory.heapUsed).toBeDefined();
      expect(res.body.node).toBeDefined();
      expect(res.body.node.version).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeDefined();
    });

    it('1.2 返回正确的内存信息格式', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      // 检查内存格式包含 MB 后缀
      expect(res.body.memory.heapUsed).toMatch(/^\d+MB$/);
      expect(res.body.memory.heapTotal).toMatch(/^\d+MB$/);
      expect(res.body.memory.rss).toMatch(/^\d+MB$/);
    });

    it('1.3 返回正确的时间戳格式', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      // ISO 8601 格式
      const timestamp = new Date(res.body.timestamp);
      expect(timestamp.toISOString()).toBe(res.body.timestamp);
    });

    it('1.4 返回正确的运行时间格式', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      // 格式如 "123s"
      expect(res.body.uptime).toMatch(/^\d+s$/);
    });

    it('1.5 返回 Node 环境信息', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.node.version).toMatch(/^v\d+\.\d+\.\d+$/);
      expect(['development', 'test', 'production']).toContain(res.body.node.env);
    });
  });
});
