// tests/test_different_routes/users.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");
const User = require('../../models/User');

jest.setTimeout(30000);

describe('用户模块路由测试 (User Routes)', () => {

  let userToken;
  let userId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_users';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});

    // 注册用户
    await request(app).post('/api/auth/register').send({
      username: 'profile_user',
      password: '123',
      role: 'user'
    });
    const login = await request(app).post('/api/auth/login').send({
      username: 'profile_user',
      password: '123'
    });
    userToken = login.body.token;
    userId = login.body.user._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 获取个人信息 (GET /api/users/profile)
  // ==========================================
  describe('GET /api/users/profile (获取个人信息)', () => {

    it('1.1 获取成功：返回用户信息', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.username).toBe('profile_user');
      expect(res.body.role).toBe('user');
      expect(res.body).not.toHaveProperty('password'); // 不应返回密码
    });

    it('1.2 无认证：返回 401', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.statusCode).toBe(401);
    });

    it('1.3 无效 Token：返回 401', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid_token_here');
      expect(res.statusCode).toBe(401);
    });
  });

  // ==========================================
  // 2. 修改个人资料 (PUT /api/users/profile)
  // ==========================================
  describe('PUT /api/users/profile (修改个人资料)', () => {

    it('2.1 修改头像成功', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          avatar: '/uploads/avatars/new-avatar.jpg'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.avatar).toBe('/uploads/avatars/new-avatar.jpg');
    });

    it('2.2 修改性别成功', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          gender: 'male'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.gender).toBe('male');
    });

    it('2.3 修改个人简介成功', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bio: '热爱旅行的资深驴友'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.bio).toBe('热爱旅行的资深驴友');
    });

    it('2.4 同时修改多个字段', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          avatar: '/uploads/avatars/multi-test.jpg',
          gender: 'female',
          bio: '喜欢探索新地方'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.avatar).toBe('/uploads/avatars/multi-test.jpg');
      expect(res.body.gender).toBe('female');
      expect(res.body.bio).toBe('喜欢探索新地方');
    });

    it('2.5 返回结果不包含密码', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bio: '测试密码不返回'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).not.toHaveProperty('password');
    });

    it('2.6 无认证：返回 401', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .send({ bio: 'no auth' });
      expect(res.statusCode).toBe(401);
    });

    it('2.7 无法修改角色 (安全性测试)', async () => {
      // 用户尝试将自己的角色改为 admin
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          role: 'admin' // 恶意尝试
        });

      expect(res.statusCode).toBe(200);
      // 角色不应该被修改
      const user = await User.findById(userId);
      expect(user.role).toBe('user');
    });

    it('2.8 无法修改用户名 (安全性测试)', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'hacked_username' // 恶意尝试
        });

      expect(res.statusCode).toBe(200);
      // 用户名不应该被修改
      const user = await User.findById(userId);
      expect(user.username).toBe('profile_user');
    });
  });

  // ==========================================
  // 3. 错误处理测试 (Error Handling)
  // ==========================================
  describe('错误处理测试', () => {
    it('3.1 GET - 用户不存在返回 404', async () => {
      // 删除用户后尝试获取
      const tempUser = await User.create({
        username: 'temp_delete_user',
        password: 'hashedpwd',
        role: 'user'
      });
      const jwt = require('jsonwebtoken');
      const tempToken = jwt.sign(
        { userId: tempUser._id, role: 'user' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      // 删除用户
      await User.findByIdAndDelete(tempUser._id);

      // 尝试获取已删除用户的 profile
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.msg).toBe('用户不存在');
    });

    it('3.2 PUT - 用户不存在返回 404', async () => {
      // 创建临时用户并获取 token
      const tempUser = await User.create({
        username: 'temp_put_user',
        password: 'hashedpwd',
        role: 'user'
      });
      const jwt = require('jsonwebtoken');
      const tempToken = jwt.sign(
        { userId: tempUser._id, role: 'user' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      // 删除用户
      await User.findByIdAndDelete(tempUser._id);

      // 尝试更新已删除用户的 profile
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ bio: 'test' });

      expect(res.statusCode).toBe(404);
      expect(res.body.msg).toBe('用户不存在');
    });
  });
});
