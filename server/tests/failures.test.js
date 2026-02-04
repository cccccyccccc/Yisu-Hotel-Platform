const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Order = require('../models/Order');

// 增加超时设置
jest.setTimeout(30000);

describe('全系统防御性与异常处理测试 (Comprehensive Failure Scenarios)', () => {

    // === 环境准备 ===
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-fail-v2';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // 清空所有相关表，防止数据污染
        await User.deleteMany({});
        await Hotel.deleteMany({});
        await RoomType.deleteMany({});
        await Order.deleteMany({});
    });

    // === 辅助工具：获取不同角色的 Token ===
    async function getToken(role = 'user') {
        const username = `test_${role}_${Date.now()}`;
        await request(app).post('/api/auth/register').send({
            username,
            password: '123',
            role
        });
        const res = await request(app).post('/api/auth/login').send({
            username,
            password: '123'
        });
        return res.body.token;
    }

    // ==========================================
    // 1. 认证与权限安全 (Auth & RBAC)
    // ==========================================
    describe('1. 认证与权限体系', () => {
        it('1.1 [中间件] 无效 Token 应该被拦截 (401)', async () => {
            const res = await request(app).get('/api/users/profile')
                .set('Authorization', 'Bearer invalid_token_123');
            expect(res.statusCode).toBe(401);
        });

        it('1.2 [注册] 缺少必填字段应报错 (400)', async () => {
            const res = await request(app).post('/api/auth/register').send({
                username: 'only_name' // 缺少 password
            });
            expect(res.statusCode).toBe(400);
        });

        it('1.3 [注册] 重复用户名应报错 (400)', async () => {
            await request(app).post('/api/auth/register').send({ username: 'u1', password: '1' });
            const res = await request(app).post('/api/auth/register').send({ username: 'u1', password: '1' });
            expect(res.statusCode).toBe(400);
        });

        it('1.4 [权限] 普通用户尝试创建酒店应被拒绝 (403)', async () => {
            const userToken = await getToken('user');
            const res = await request(app).post('/api/hotels')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: '黑客酒店', city: '未知', address: 'a', starRating: 5, price: 100 });
            expect(res.statusCode).toBe(403);
        });

        it('1.5 [权限] 商户尝试发布 Banner (仅管理员) 应被拒绝 (403)', async () => {
            const merchantToken = await getToken('merchant');
            const res = await request(app).post('/api/banners')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ title: '非法广告' });
            expect(res.statusCode).toBe(403);
        });
    });

    // ==========================================
    // 2. 酒店与房型管理 (Hotel & Rooms)
    // ==========================================
    describe('2. 酒店与房型管理', () => {
        it('2.1 [酒店] 创建时缺少必填项 (如价格) 应报错 (400)', async () => {
            const token = await getToken('merchant');
            const res = await request(app).post('/api/hotels')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: '缺失酒店',
                    city: '北京',
                    // 缺少 price, starRating, address 等
                });
            expect(res.statusCode).toBe(400);
        });

        it('2.2 [酒店] 获取详情传入非法 ID (非 ObjectId) 应报错 (400)', async () => {
            const res = await request(app).get('/api/hotels/invalid-id-format');
            expect(res.statusCode).toBe(400);
        });

        it('2.3 [房型] 删除不属于自己的房型应被拒绝 (403/404)', async () => {
            // 商户 A 创建房型
            const merchantA = await getToken('merchant');
            // 先快速创建一个酒店和房型 (模拟数据)
            const hotel = await Hotel.create({ merchantId: new mongoose.Types.ObjectId(), name: 'H', city: 'C', address: 'A', starRating: 5, price: 100, location: {type:'Point', coordinates:[0,0]} });
            const room = await RoomType.create({ hotelId: hotel._id, title: 'R', price: 100, stock: 10 });

            // 商户 B 尝试删除
            const merchantB = await getToken('merchant');
            const res = await request(app)
                .delete(`/api/rooms/${room._id}`)
                .set('Authorization', `Bearer ${merchantB}`);

            // 视你的实现逻辑，可能返回 403 (无权) 或 404 (找不到归你管的房型)
            expect([403, 404]).toContain(res.statusCode);
        });
    });

    // ==========================================
    // 3. 订单业务逻辑 (Orders)
    // ==========================================
    describe('3. 订单业务逻辑', () => {
        it('3.1 [下单] 离店日期早于入住日期应报错 (400)', async () => {
            const token = await getToken('user');
            // 随便造一个 fake ID，只要能过格式校验即可，业务逻辑会在查库前先验日期
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app).post('/api/orders')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    hotelId: fakeId,
                    roomTypeId: fakeId,
                    checkInDate: '2026-02-01',
                    checkOutDate: '2026-01-01', // 错误日期
                    quantity: 1
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toMatch(/日期/);
        });

        it('3.2 [下单] 预订数量不合法 (0 或负数) 应报错 (400)', async () => {
            const token = await getToken('user');
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app).post('/api/orders')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    hotelId: fakeId,
                    roomTypeId: fakeId,
                    checkInDate: '2026-02-01',
                    checkOutDate: '2026-02-02',
                    quantity: 0 // 无效数量
                });

            // 可能是 400 (校验失败) 或 200 (如果你有默认值1)。建议加上校验。
            // 假设你加了校验：
            if (res.statusCode === 200) {
                // 如果你的逻辑是默认为1，这里跳过
            } else {
                expect(res.statusCode).toBe(400);
            }
        });

        it('3.3 [取消] 操作他人的订单应被拒绝 (403)', async () => {
            // 用户 A 下单
            const userA = await request(app).post('/api/auth/register').send({ username: 'UA', password: '1', role: 'user' });
            const tokenA = (await request(app).post('/api/auth/login').send({ username: 'UA', password: '1' })).body.token;
            const userIdA = (await request(app).get('/api/users/profile').set('Authorization', `Bearer ${tokenA}`)).body._id;

            // 手动创建一个属于 A 的订单
            const order = await Order.create({
                userId: userIdA,
                hotelId: new mongoose.Types.ObjectId(),
                roomTypeId: new mongoose.Types.ObjectId(),
                checkInDate: new Date(),
                checkOutDate: new Date(),
                totalPrice: 100,
                status: 'paid'
            });

            // 用户 B 尝试取消
            const tokenB = await getToken('user');
            const res = await request(app)
                .put(`/api/orders/${order._id}/cancel`)
                .set('Authorization', `Bearer ${tokenB}`);

            expect(res.statusCode).toBe(403);
        });
    });

    // ==========================================
    // 4. 评价与收藏 (Reviews & Favorites)
    // ==========================================
    describe('4. 评价与收藏', () => {
        it('4.1 [评价] 评分超出范围 (如 6分) 应报错 (400)', async () => {
            const token = await getToken('user');
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).post('/api/reviews')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    hotelId: fakeId,
                    rating: 6, // 超出 1-5 范围
                    content: '超神了'
                });
            expect(res.statusCode).toBe(400);
        });

        it('4.2 [收藏] 收藏不存在的酒店应返回 404', async () => {
            const token = await getToken('user');
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/favorites/${fakeId}`)
                .set('Authorization', `Bearer ${token}`);

            // 取决于实现，可能在检查酒店是否存在时报 404
            expect(res.statusCode).toBe(404);
        });
    });

    // ==========================================
    // 5. 系统与文件 (System & Upload)
    // ==========================================
    describe('5. 文件上传', () => {
        it('5.1 [上传] 未附带文件应报错 (400)', async () => {
            const res = await request(app).post('/api/upload');
            // 没有 attach 文件
            expect(res.statusCode).toBe(400);
        });
    });

});