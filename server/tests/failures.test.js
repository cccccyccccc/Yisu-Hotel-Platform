const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

// 增加超时设置：30秒
jest.setTimeout(30000);

describe('防御性与异常处理测试 (Failure Scenarios)', () => {

    // 测试前连接数据库
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
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

    // 辅助函数：注册并登录获取 Token
    async function getAuthToken() {
        await request(app).post('/api/auth/register').send({ username: 'temp_user', password: '123', role: 'merchant' });
        const res = await request(app).post('/api/auth/login').send({ username: 'temp_user', password: '123' });
        return res.body.token;
    }

    // ==========================================
    // 1. 专门测试 authMiddleware 的异常处理
    // ==========================================
    it('1.1 应该拦截无效的 Token (触发 authMiddleware catch 块)', async () => {
        const res = await request(app)
            .get('/api/favorites')
            .set('Authorization', 'Bearer invalid_garbage_token_123');
        expect(res.statusCode).toBe(401);
    });

    it('1.2 应该拦截没有 Token 的请求', async () => {
        const res = await request(app).get('/api/favorites');
        expect(res.statusCode).toBe(401);
    });

    // ==========================================
    // 2. 测试 Auth 路由的校验逻辑
    // ==========================================
    it('2.1 注册时缺少字段应报错', async () => {
        const res = await request(app).post('/api/auth/register').send({
            username: 'testuser'
        });
        expect(res.statusCode).toBe(400);
    });

    it('2.2 注册已存在的用户应报错', async () => {
        await request(app).post('/api/auth/register').send({ username: 'duplicate_user', password: '123' });
        const res = await request(app).post('/api/auth/register').send({ username: 'duplicate_user', password: '123' });
        expect(res.statusCode).toBe(400);
    });

    // ==========================================
    // 3. 测试 Favorites 路由的 ID 校验
    // ==========================================
    it('3.1 传入非法的 ObjectId 应该被拦截 (防止 CastError)', async () => {
        const token = await getAuthToken(); // 🟢 修复：确保先注册再获取 Token
        const res = await request(app)
            .post('/api/favorites/bad-id-123')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(400);
    });

    it('3.2 操作不存在的酒店应返回 404', async () => {
        const token = await getAuthToken(); // 🟢 修复
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/favorites/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(404);
    });

    // ==========================================
    // 4. 酒店管理异常测试
    // ==========================================
    it('4.1 创建酒店时缺少必填字段应报错', async () => {
        const token = await getAuthToken(); // 🟢 修复
        const res = await request(app)
            .post('/api/hotels')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: '这家酒店没有名字' }); // 缺少 name 等必填项
        expect(res.statusCode).toBe(400);
    });

    it('4.2 更新不存在的酒店应返回 404 或 400', async () => {
        const token = await getAuthToken(); // 🟢 修复
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/hotels/${fakeId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: '更新名字' });

        // 你的代码里加了 ID 校验返回 400，找不到返回 404，两者都算通过
        expect([400, 404]).toContain(res.statusCode);
    });

    it('4.3 传入非法 ID 获取详情应被拦截', async () => {
        const res = await request(app).get('/api/hotels/bad-id-123');
        expect(res.statusCode).toBe(400);
    });

    // ==========================================
    // 5. 房型管理异常测试
    // ==========================================
    it('5.1 创建房型时关联不存在的酒店应报错', async () => {
        const token = await getAuthToken(); // 🟢 修复
        const fakeHotelId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${token}`)
            .send({
                hotelId: fakeHotelId,
                title: '总统套房',
                price: 999,
                stock: 10
            });

        // 你的代码里先校验了必填项，如果必填项都在，就会校验 hotelId
        expect([400, 404, 403]).toContain(res.statusCode);
    });

    it('5.2 删除房型时传入非法 ID 应报错', async () => {
        const token = await getAuthToken(); // 🟢 修复
        const res = await request(app)
            .delete('/api/rooms/bad-room-id')
            .set('Authorization', `Bearer ${token}`);

        // 你的 rooms.js 路由里加了 isValid 校验，所以是 400
        expect(res.statusCode).toBe(400);
    });
});