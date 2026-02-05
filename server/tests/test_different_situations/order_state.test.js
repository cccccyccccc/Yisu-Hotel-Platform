// 订单测试

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const Order = require('../../models/Order');
const User = require('../../models/User');

describe('订单状态流转与限制测试 (Order State Machine)', () => {
    let userToken, userId;

    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-state';
        await mongoose.connect(TEST_URI);

        await User.deleteMany({});
        await Order.deleteMany({});

        // 注册用户
        await request(app).post('/api/auth/register').send({ username: 'state_user', password: '123', role: 'user' });
        const loginRes = await request(app).post('/api/auth/login').send({ username: 'state_user', password: '123' });
        userToken = loginRes.body.token;
        userId = loginRes.body.user.id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // 辅助函数：直接在数据库创建一个指定状态的订单
    const createOrderWithStatus = async (status) => {
        const order = await Order.create({
            userId,
            hotelId: new mongoose.Types.ObjectId(),
            roomTypeId: new mongoose.Types.ObjectId(),
            checkInDate: new Date(),
            checkOutDate: new Date(),
            quantity: 1,
            totalPrice: 100,
            status: status
        });
        return order._id;
    };

    it('1. [正常流程] 已支付(paid)订单可以取消', async () => {
        const id = await createOrderWithStatus('paid');
        const res = await request(app)
            .put(`/api/orders/${id}/cancel`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('cancelled');
    });

    it('2. [非法流转] 已完成(completed)订单不可取消', async () => {
        // 场景：用户住完了走了，想退款，这肯定是不行的
        const id = await createOrderWithStatus('completed');
        const res = await request(app)
            .put(`/api/orders/${id}/cancel`)
            .set('Authorization', `Bearer ${userToken}`);

        // 你的代码逻辑里应该限制了只有 paid/pending 可以取消
        expect(res.statusCode).toBe(400);
    });

    it('3. [重复操作] 已取消(cancelled)订单不可再次取消', async () => {
        const id = await createOrderWithStatus('cancelled');
        const res = await request(app)
            .put(`/api/orders/${id}/cancel`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(400); // 应该提示"当前状态无法取消"
    });

    it('4. [非法流转] 待确认(pending)订单可以取消', async () => {
        const id = await createOrderWithStatus('pending');
        const res = await request(app)
            .put(`/api/orders/${id}/cancel`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('cancelled');
    });
});