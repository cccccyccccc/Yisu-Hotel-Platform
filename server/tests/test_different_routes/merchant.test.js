// tests/test_different_routes/merchant.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const Order = require('../../models/Order');
const RoomType = require('../../models/RoomType');
const Review = require('../../models/Review');

jest.setTimeout(30000);

describe('商户模块路由测试 (Merchant Routes)', () => {

  let merchantToken, userToken;
  let merchantId, userId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_merchant';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Order.deleteMany({});
    await Review.deleteMany({});
    await RoomType.deleteMany({});

    // 注册商户
    await request(app).post('/api/auth/register').send({ username: 'stats_merchant', password: '123', role: 'merchant' });
    const loginMer = await request(app).post('/api/auth/login').send({ username: 'stats_merchant', password: '123' });
    merchantToken = loginMer.body.token;
    merchantId = loginMer.body.user._id;

    // 注册普通用户
    await request(app).post('/api/auth/register').send({ username: 'stats_user', password: '123', role: 'user' });
    const loginUser = await request(app).post('/api/auth/login').send({ username: 'stats_user', password: '123' });
    userToken = loginUser.body.token;
    userId = loginUser.body.user._id;

    // 创建测试酒店
    const hotel = await Hotel.create({
      merchantId: merchantId,
      name: '统计测试酒店',
      city: '上海',
      address: '测试路1号',
      starRating: 5,
      price: 500,
      location: { type: 'Point', coordinates: [121.4, 31.2] },
      status: 1
    });
    const hotelId = hotel._id;

    // 创建房型
    const roomType = await RoomType.create({
      hotelId: hotelId,
      title: '豪华套房',
      price: 500,
      stock: 10
    });

    // 创建订单
    await Order.create({
      userId: userId,
      hotelId: hotelId,
      roomTypeId: roomType._id,
      checkInDate: new Date(),
      checkOutDate: new Date(Date.now() + 86400000),
      totalPrice: 500,
      status: 'paid'
    });

    // 创建评价
    await Review.create({
      userId: userId,
      hotelId: hotelId,
      rating: 5,
      content: '非常棒的酒店！'
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 商户统计数据 (GET /api/merchant/stats)
  // ==========================================
  describe('GET /api/merchant/stats (商户统计)', () => {

    it('1.1 商户获取统计数据成功', async () => {
      const res = await request(app)
        .get('/api/merchant/stats')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.hotels).toBeDefined();
      expect(res.body.orders).toBeDefined();
      expect(res.body.reviews).toBeDefined();
    });

    it('1.2 权限拒绝：普通用户无法获取商户统计', async () => {
      const res = await request(app)
        .get('/api/merchant/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('1.3 未登录：返回401', async () => {
      const res = await request(app).get('/api/merchant/stats');
      expect(res.statusCode).toBe(401);
    });
  });
});
