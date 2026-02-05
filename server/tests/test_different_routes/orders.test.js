// tests/test_different_routes/orders.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const RoomType = require('../../models/RoomType');
const Order = require('../../models/Order');

jest.setTimeout(30000);

describe('订单模块路由测试 (Order Routes)', () => {

  let merchantToken, userToken;
  let merchantId, userId;
  let hotelId, roomId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_orders';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await RoomType.deleteMany({});
    await Order.deleteMany({});

    // 注册商户
    await request(app).post('/api/auth/register').send({ username: 'order_mer', password: '123', role: 'merchant' });
    const loginMer = await request(app).post('/api/auth/login').send({ username: 'order_mer', password: '123' });
    merchantToken = loginMer.body.token;
    merchantId = loginMer.body.user.id;

    // 注册用户
    await request(app).post('/api/auth/register').send({ username: 'order_user', password: '123', role: 'user' });
    const loginUser = await request(app).post('/api/auth/login').send({ username: 'order_user', password: '123' });
    userToken = loginUser.body.token;
    userId = loginUser.body.user.id;

    // 创建酒店 (直接设为上线)
    const hotel = await Hotel.create({
      merchantId: merchantId,
      name: '订单测试酒店',
      city: '上海',
      address: '浦东新区',
      starRating: 4,
      price: 500,
      location: { type: 'Point', coordinates: [121.5, 31.2] },
      status: 1
    });
    hotelId = hotel._id;

    // 创建房型，库存 3
    const room = await RoomType.create({
      hotelId: hotelId,
      title: '豪华大床房',
      price: 500,
      stock: 3
    });
    roomId = room._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 创建订单 (POST /api/orders)
  // ==========================================
  describe('POST /api/orders (创建订单)', () => {

    beforeEach(async () => {
      await Order.deleteMany({});
    });

    it('1.1 创建成功：用户下单返回订单信息', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          roomTypeId: roomId,
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-03',
          quantity: 1
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('paid');
      expect(res.body.totalPrice).toBe(500 * 1 * 2); // 价格 * 数量 * 天数
    });

    it('1.2 日期无效：入住日期晚于离店日期', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          roomTypeId: roomId,
          checkInDate: '2026-06-05',
          checkOutDate: '2026-06-01',
          quantity: 1
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe('日期无效');
    });

    it('1.3 数量无效：数量为 0', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          roomTypeId: roomId,
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-03',
          quantity: 0
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe('数量必须大于0');
    });

    it('1.4 房型不存在', async () => {
      const fakeRoomId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          roomTypeId: fakeRoomId,
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-03',
          quantity: 1
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.msg).toBe('房型不存在');
    });

    it('1.5 库存不足：超出库存数量', async () => {
      // 先下一单占用2间
      await Order.create({
        userId: userId,
        hotelId: hotelId,
        roomTypeId: roomId,
        checkInDate: new Date('2026-07-01'),
        checkOutDate: new Date('2026-07-03'),
        quantity: 2,
        totalPrice: 2000,
        status: 'paid'
      });

      // 再下单2间，超过库存(3)
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          roomTypeId: roomId,
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-03',
          quantity: 2
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain('库存不足');
    });
  });

  // ==========================================
  // 2. 获取我的订单 (GET /api/orders/my)
  // ==========================================
  describe('GET /api/orders/my (我的订单)', () => {

    beforeAll(async () => {
      await Order.deleteMany({});
      // 创建测试订单
      await Order.create({
        userId: userId,
        hotelId: hotelId,
        roomTypeId: roomId,
        checkInDate: new Date('2026-08-01'),
        checkOutDate: new Date('2026-08-03'),
        quantity: 1,
        totalPrice: 1000,
        status: 'paid'
      });
    });

    it('2.1 获取成功：返回用户订单列表', async () => {
      const res = await request(app)
        .get('/api/orders/my')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].userId).toBe(userId);
    });

    it('2.2 无认证：返回 401', async () => {
      const res = await request(app).get('/api/orders/my');
      expect(res.statusCode).toBe(401);
    });
  });

  // ==========================================
  // 3. 取消订单 (PUT /api/orders/:id/cancel)
  // ==========================================
  describe('PUT /api/orders/:id/cancel (取消订单)', () => {

    let orderId;

    beforeEach(async () => {
      await Order.deleteMany({});
      const order = await Order.create({
        userId: userId,
        hotelId: hotelId,
        roomTypeId: roomId,
        checkInDate: new Date('2026-09-01'),
        checkOutDate: new Date('2026-09-03'),
        quantity: 1,
        totalPrice: 1000,
        status: 'paid'
      });
      orderId = order._id;
    });

    it('3.1 取消成功', async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('3.2 订单不存在', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/orders/${fakeId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.msg).toBe('订单不存在');
    });

    it('3.3 无权操作：非本人订单', async () => {
      // 用商户 token 尝试取消用户的订单
      const res = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.msg).toBe('无权操作');
    });

    it('3.4 已取消订单无法再次取消', async () => {
      // 先取消
      await Order.findByIdAndUpdate(orderId, { status: 'cancelled' });

      const res = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe('无法取消');
    });
  });
});
