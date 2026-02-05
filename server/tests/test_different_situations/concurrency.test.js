// 并发测试

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const RoomType = require('../../models/RoomType');
const Order = require('../../models/Order');

// === 配置参数 ===
const INITIAL_STOCK = 5;       // 只有 5 间房
const CONCURRENT_REQUESTS = 20; // 20 人同时抢

let userToken, userId;
let hotelId, roomTypeId;

beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-concurrency';
    await mongoose.connect(TEST_URI);

    // 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await RoomType.deleteMany({});
    await Order.deleteMany({});

    // 1. 准备用户
    await request(app).post('/api/auth/register').send({
        username: 'concurrent_user', password: 'password123', role: 'user'
    });
    const loginRes = await request(app).post('/api/auth/login').send({
        username: 'concurrent_user', password: 'password123'
    });
    userToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // 2. 准备酒店
    const hotel = await Hotel.create({
        merchantId: new mongoose.Types.ObjectId(),
        name: '并发测试酒店',
        city: '上海',
        address: '测试路1号',
        starRating: 5,
        price: 500,
        location: { type: 'Point', coordinates: [121.0, 31.0] }
    });
    hotelId = hotel._id;

    // 3. 准备房型 (库存设为 5)
    const room = await RoomType.create({
        hotelId: hotelId,
        title: '特价抢购房',
        price: 100,
        stock: INITIAL_STOCK // <--- 重点：只有 5 间
    });
    roomTypeId = room._id;
});

afterAll(async () => {
    await mongoose.connection.close();
});

describe('🔥 高并发抢房测试', () => {

    it(`模拟 ${CONCURRENT_REQUESTS} 人抢 ${INITIAL_STOCK} 间房，应无超卖`, async () => {
        console.log(`🚀 开始并发测试：${CONCURRENT_REQUESTS} 个请求同时发出...`);

        // 构造 20 个并发 Promise
        const promises = [];
        for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
            const req = request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    hotelId,
                    roomTypeId,
                    checkInDate: '2026-12-31',
                    checkOutDate: '2027-01-01',
                    quantity: 1
                });
            promises.push(req);
        }

        // 等待所有请求完成
        const responses = await Promise.all(promises);

        // 统计结果
        let successCount = 0;
        let failCount = 0;

        responses.forEach(res => {
            if (res.status === 200) {
                successCount++;
            } else {
                failCount++;
            }
        });

        console.log(`📊 测试结果: 成功 ${successCount} 单, 失败 ${failCount} 单`);

        // === 验证逻辑 ===

        // 1. 成功订单数必须严格等于库存数 (不能超卖)
        expect(successCount).toBe(INITIAL_STOCK);

        // 2. 失败订单数必须是剩下的
        expect(failCount).toBe(CONCURRENT_REQUESTS - INITIAL_STOCK);

        // 3. 验证数据库状态
        // [修正点]：库存字段(Stock)应该保持不变(5)，因为它代表总物理房间数
        const room = await RoomType.findById(roomTypeId);
        console.log(`📦 最终数据库总库存(物理): ${room.stock}`);
        expect(room.stock).toBe(INITIAL_STOCK);

        // 4. [新增验证] 尝试第 21 次下单，应该失败 (验证可用库存确实为 0)
        const extraRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                hotelId,
                roomTypeId,
                checkInDate: '2026-12-31',
                checkOutDate: '2027-01-01',
                quantity: 1
            });

        expect(extraRes.status).not.toBe(200); // 应该抢不到了
    });
});