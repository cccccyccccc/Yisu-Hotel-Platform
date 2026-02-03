const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

// 引入模型
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Order = require('../models/Order');

// 变量
let userToken;
let hotelId, roomTypeId;
const INITIAL_STOCK = 5;  // 初始库存只有 5 间
const CONCURRENT_REQUESTS = 20; // 模拟 20 人同时抢

// === 环境准备 ===
beforeAll(async () => {
    // 1. 连接测试数据库
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-concurrency';
    await mongoose.connect(TEST_URI);

    // 2. 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await RoomType.deleteMany({});
    await Order.deleteMany({});

    // 3. 准备基础数据
    // 3.1 注册并登录一个普通用户 (抢房者)
    await request(app).post('/api/auth/register').send({
        username: 'buyer_01', password: 'password123', role: 'user'
    });
    const loginRes = await request(app).post('/api/auth/login').send({
        username: 'buyer_01', password: 'password123'
    });
    userToken = loginRes.body.token;

    // 3.2 注册一个商户 (发布房型)
    await request(app).post('/api/auth/register').send({
        username: 'merchant_01', password: 'password123', role: 'merchant'
    });
    const merchLogin = await request(app).post('/api/auth/login').send({
        username: 'merchant_01', password: 'password123'
    });
    const merchantToken = merchLogin.body.token;

    // 3.3 发布酒店
    // ⚠️⚠️⚠️ 关键修复：这里添加 location 字段 ⚠️⚠️⚠️
    const hotelRes = await request(app).post('/api/hotels')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
            name: '并发测试酒店', city: '上海', address: '测试路1号',
            starRating: 5, price: 100, openingTime: '2023',
            status: 1, // 直接设为已发布
            location: {
                type: 'Point',
                coordinates: [121.4737, 31.2304] // [经度, 纬度]
            }
        })
        .expect(200); // 确保这里返回 200，如果之前报错这里就会抛出异常

    hotelId = hotelRes.body._id;

    // 3.4 发布房型 (关键：库存设为 5)
    const roomRes = await request(app).post('/api/rooms')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
            hotelId, title: '秒杀房', price: 100,
            stock: INITIAL_STOCK, // <--- 只有 5 间
            capacity: 2
        });
    roomTypeId = roomRes.body._id;
});

afterAll(async () => {
    await mongoose.connection.close();
});

// ==========================================
// 核心测试：并发抢购
// ==========================================
describe('🔥 高并发抢房测试', () => {

    it(`模拟 ${CONCURRENT_REQUESTS} 人抢 ${INITIAL_STOCK} 间房，应无超卖`, async () => {
        console.log(`🚀 开始并发测试：${CONCURRENT_REQUESTS} 个请求同时发出...`);

        // 1. 构造 20 个并发请求 Promise
        const requests = Array(CONCURRENT_REQUESTS).fill().map((_, index) => {
            return request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    hotelId,
                    roomTypeId,
                    checkInDate: '2026-10-01',
                    checkOutDate: '2026-10-02',
                    quantity: 1
                })
                .then(res => ({
                    status: res.status,
                    msg: res.body.msg || '下单成功',
                    index
                }));
        });

        // 2. 等待所有请求完成
        const results = await Promise.all(requests);

        // 3. 统计结果
        const successCount = results.filter(r => r.status === 200).length;
        const failCount = results.filter(r => r.status !== 200).length;

        console.log(`📊 测试结果: 成功 ${successCount} 单, 失败 ${failCount} 单`);

        // 4. 断言验证
        // 4.1 成功订单数必须等于初始库存 (5单)
        expect(successCount).toBe(INITIAL_STOCK);

        // 4.2 失败订单数必须是 15 单
        expect(failCount).toBe(CONCURRENT_REQUESTS - INITIAL_STOCK);

        // 4.3 验证数据库库存是否刚好为 0 (不能是负数)
        const room = await RoomType.findById(roomTypeId);
        console.log(`📦 最终数据库库存: ${room.stock}`);
        expect(room.stock).toBe(0);

        // 4.4 验证数据库订单数是否为 5
        const orderCount = await Order.countDocuments();
        expect(orderCount).toBe(INITIAL_STOCK);
    });
});