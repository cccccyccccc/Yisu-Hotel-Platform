const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

jest.setTimeout(30000);

describe('防御性与异常处理测试 (Failure Scenarios)', () => {

    // 测试前连接数据库
    beforeAll(async () => {
        // 🔴 修正：去掉了 if (process.env.NODE_ENV !== 'test') 判断
        // 只要不是已连接状态，就进行连接
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/yisu-test-fail');
        }
    });

    // 测试后断开
    afterAll(async () => {
        // 确保断开连接，防止 Jest 报 "did not exit" 错误
        await mongoose.connection.close();
    });

    // 每个测试前清空数据
    beforeEach(async () => {
        await User.deleteMany({});
    });

    // ==========================================
    // 1. 专门测试 authMiddleware 的异常处理
    // ==========================================
    it('1.1 应该拦截无效的 Token (触发 authMiddleware catch 块)', async () => {
        const res = await request(app)
            .get('/api/favorites')
            .set('Authorization', 'Bearer invalid_garbage_token_123');

        // 预期 401，且触发了 console.error
        expect(res.statusCode).toBe(401);
    });

    it('1.2 应该拦截没有 Token 的请求', async () => {
        const res = await request(app)
            .get('/api/favorites'); // 不传 Authorization 头

        expect(res.statusCode).toBe(401);
    });

    // ==========================================
    // 2. 测试 Auth 路由的校验逻辑
    // ==========================================
    it('2.1 注册时缺少字段应报错', async () => {
        const res = await request(app).post('/api/auth/register').send({
            username: 'testuser'
            // 故意不传 password
        });
        expect(res.statusCode).toBe(400);
    });

    it('2.2 注册已存在的用户应报错', async () => {
        // 先注册一个
        await request(app).post('/api/auth/register').send({
            username: 'duplicate_user',
            password: '123'
        });

        // 再注册同一个
        const res = await request(app).post('/api/auth/register').send({
            username: 'duplicate_user',
            password: '123'
        });

        expect(res.statusCode).toBe(400);
    });

    // ==========================================
    // 3. 测试 Favorites 路由的 ID 校验 (ObjectId)
    // ==========================================
    it('3.1 传入非法的 ObjectId 应该被拦截 (防止 CastError)', async () => {
        // 先登录拿到 Token
        await request(app).post('/api/auth/register').send({ username: 'u1', password: '123' });
        const loginRes = await request(app).post('/api/auth/login').send({ username: 'u1', password: '123' });
        const token = loginRes.body.token;

        // 故意传一个非法的 ID "bad-id-123"
        const res = await request(app)
            .post('/api/favorites/bad-id-123')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(400);
    });

    it('3.2 操作不存在的酒店应返回 404', async () => {
        // 登录
        await request(app).post('/api/auth/register').send({ username: 'u2', password: '123' });
        const loginRes = await request(app).post('/api/auth/login').send({ username: 'u2', password: '123' });
        const token = loginRes.body.token;

        // 传一个合法的 ObjectId，但数据库里没有这个酒店
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/favorites/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(404);
    });
});