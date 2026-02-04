const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server/app'); // 根据你的项目结构调整路径
const User = require('../server/models/User');

describe('防御性与异常处理测试 (Failure Scenarios)', () => {

    // 测试前连接数据库
    beforeAll(async () => {
        if (process.env.NODE_ENV !== 'test') {
            await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/yisu-test-fail');
        }
    });

    // 测试后断开
    afterAll(async () => {
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
        // 故意传一个乱七八糟的 Token
        const res = await request(app)
            .get('/api/favorites') // 这是一个受保护的路由
            .set('Authorization', 'Bearer invalid_garbage_token_123');

        // 预期：401 Unauthorized
        // 你的中间件里写了 console.error(err)，这会触发它
        expect(res.statusCode).toBe(401);
        expect(res.body.msg).toMatch(/无效|过期/);
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
        expect(res.body.msg).toMatch(/已注册|存在/);
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

        // 因为你加了 mongoose.Types.ObjectId.isValid() 判断
        // 所以这里预期是 400 Bad Request，而不是 500 Server Error
        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toMatch(/无效/);
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