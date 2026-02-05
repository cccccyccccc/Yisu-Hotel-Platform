// 安全性测试

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Order = require('../../models/Order');

describe('安全专项测试 (Security: IDOR & Injection)', () => {
    let attackerToken;
    let victimOrderId;

    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-security';
        await mongoose.connect(TEST_URI);
        await User.deleteMany({});
        await Order.deleteMany({});

        // 1. 创建受害者 (Victim)
        await request(app).post('/api/auth/register').send({ username: 'victim', password: 'secure_password', role: 'user' });
        const vLogin = await request(app).post('/api/auth/login').send({ username: 'victim', password: 'secure_password' });

        const victimId = vLogin.body.user.id;

        // 受害者创建了一个订单
        const order = await Order.create({
            userId: victimId,
            hotelId: new mongoose.Types.ObjectId(),
            roomTypeId: new mongoose.Types.ObjectId(),
            checkInDate: new Date(),
            checkOutDate: new Date(),
            quantity: 1,
            totalPrice: 999,
            status: 'paid'
        });
        victimOrderId = order._id;

        // 2. 创建攻击者 (Attacker)
        await request(app).post('/api/auth/register').send({ username: 'attacker', password: '123', role: 'user' });
        const aLogin = await request(app).post('/api/auth/login').send({ username: 'attacker', password: '123' });
        attackerToken = aLogin.body.token;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. 越权访问测试 (IDOR)
    // ==========================================
    it('1.1 攻击者尝试取消受害者的订单应被拒绝 (403)', async () => {
        // 攻击者持有合法的 token，但是 ID 不是他的
        const res = await request(app)
            .put(`/api/orders/${victimOrderId}/cancel`)
            .set('Authorization', `Bearer ${attackerToken}`);

        // 你的 orders.js 里应该有检查 order.userId !== req.user.userId
        expect(res.statusCode).toBe(403);
    });

    // ==========================================
    // 2. NoSQL 注入测试
    // ==========================================
    it('2.1 尝试使用 NoSQL 注入绕过登录应失败', async () => {
        // 攻击载荷：{"username": "victim", "password": {"$ne": null}}
        // 如果后端直接 User.findOne(req.body)，这会登录成功！
        // 如果后端做了类型检查或使用了 sanitize，这会失败。

        const res = await request(app).post('/api/auth/login').send({
            username: 'victim',
            password: { "$ne": null } // 尝试匹配任意非空密码
        });

        // 期望：登录失败 (401 或 400 或 500)
        // 绝对不能是 200 (登录成功)
        expect(res.statusCode).not.toBe(200);
    });
});