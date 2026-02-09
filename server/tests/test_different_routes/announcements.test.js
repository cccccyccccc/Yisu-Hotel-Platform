// tests/test_different_routes/announcements.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");
const User = require('../../models/User');
const Announcement = require('../../models/Announcement');
const AnnouncementRead = require('../../models/AnnouncementRead');

jest.setTimeout(30000);

describe('公告模块路由测试 (Announcement Routes)', () => {

  let adminToken, merchantToken, userToken;
  let announcementId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_announcements';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});
    await Announcement.deleteMany({});
    await AnnouncementRead.deleteMany({});

    // 注册管理员
    await request(app).post('/api/auth/register').send({ username: 'ann_admin', password: '123', role: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ username: 'ann_admin', password: '123' });
    adminToken = loginAdmin.body.token;

    // 注册商户
    await request(app).post('/api/auth/register').send({ username: 'ann_mer', password: '123', role: 'merchant' });
    const loginMer = await request(app).post('/api/auth/login').send({ username: 'ann_mer', password: '123' });
    merchantToken = loginMer.body.token;

    // 注册普通用户
    await request(app).post('/api/auth/register').send({ username: 'ann_user', password: '123', role: 'user' });
    const loginUser = await request(app).post('/api/auth/login').send({ username: 'ann_user', password: '123' });
    userToken = loginUser.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 创建公告 (管理员)
  // ==========================================
  describe('POST /api/announcements (创建公告)', () => {

    it('1.1 管理员创建公告成功', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '系统维护通知',
          content: '系统将于今晚进行维护',
          type: 'warning' // 使用模型允许的 type 值
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.msg).toBe('公告发布成功');
      expect(res.body.data.title).toBe('系统维护通知');
      announcementId = res.body.data._id;
    });

    it('1.2 创建第二个公告', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '促销活动公告',
          content: '新年促销活动开始了',
          type: 'success' // 使用模型允许的 type 值
        });

      expect(res.statusCode).toBe(201);
    });

    it('1.3 权限拒绝：商户无法创建公告', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          title: '非法公告',
          content: '内容',
          type: 'info'
        });

      expect(res.statusCode).toBe(403);
    });

    it('1.4 参数验证：缺少标题', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: '只有内容没有标题'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  // ==========================================
  // 2. 获取公告列表
  // ==========================================
  describe('GET /api/announcements (公告列表)', () => {

    it('2.1 获取公告列表（公开接口）', async () => {
      const res = await request(app).get('/api/announcements');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // 3. 未读计数 (GET /api/announcements/unread/count)
  // ==========================================
  describe('GET /api/announcements/unread/count (未读计数)', () => {

    it('3.1 获取未读公告数量', async () => {
      const res = await request(app)
        .get('/api/announcements/unread/count')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // 4. 标记已读 (POST /api/announcements/:id/read)
  // ==========================================
  describe('POST /api/announcements/:id/read (标记已读)', () => {

    it('4.1 标记公告为已读', async () => {
      const res = await request(app)
        .post(`/api/announcements/${announcementId}/read`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.msg).toBe('已标记为已读');
    });

    it('4.2 重复标记不报错', async () => {
      const res = await request(app)
        .post(`/api/announcements/${announcementId}/read`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('4.3 未读数量应减少', async () => {
      const res = await request(app)
        .get('/api/announcements/unread/count')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1); // 原来2个，标记1个已读后剩1个
    });

    it('4.4 无效公告ID返回404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/announcements/${fakeId}/read`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================
  // 5. 管理员操作
  // ==========================================
  describe('管理员公告操作', () => {

    it('5.1 管理员获取所有公告列表', async () => {
      const res = await request(app)
        .get('/api/announcements/admin/list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('5.2 商户无权获取管理员列表', async () => {
      const res = await request(app)
        .get('/api/announcements/admin/list')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
