const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

// 测试前的准备
beforeAll(async () => {
    // 连接到测试数据库 (避免污染开发库)
    const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yisu-test-db';
    await mongoose.connect(TEST_URI);
});

// 测试后的清理
afterAll(async () => {
    await mongoose.connection.close(); // 断开数据库
});

// 每次测试前清空用户表
beforeEach(async () => {
    await User.deleteMany({});
});

describe('认证接口测试 (Auth API)', () => {

    // 测试用例 1: 注册功能
    it('应该成功注册一个新用户', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'jest_user',
                password: 'password123',
                role: 'user'
            });

        expect(res.statusCode).toEqual(201); // 期望返回 201
        expect(res.body).toHaveProperty('msg', '注册成功！请登录');
    });

    // 测试用例 2: 登录功能
    it('应该成功登录', async () => {
        // 先注册
        await request(app).post('/api/auth/register').send({
            username: 'login_user',
            password: 'password123'
        });

        // 再登录
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'login_user',
                password: 'password123'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token'); // 必须返回 token
    });
});