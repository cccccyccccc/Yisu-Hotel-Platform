// tests/test_different_routes/reviews.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const Review = require('../../models/Review');

jest.setTimeout(30000);

describe('评价模块路由测试 (Review Routes)', () => {

  let userToken, user2Token;
  let merchantId, userId, user2Id;
  let hotelId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_reviews';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Review.deleteMany({});

    // 注册商户
    await request(app).post('/api/auth/register').send({ username: 'review_mer', password: '123', role: 'merchant' });
    const loginMer = await request(app).post('/api/auth/login').send({ username: 'review_mer', password: '123' });

    merchantId = loginMer.body.user.id;

    // 注册用户1
    await request(app).post('/api/auth/register').send({ username: 'review_user1', password: '123', role: 'user' });
    const loginUser = await request(app).post('/api/auth/login').send({ username: 'review_user1', password: '123' });
    userToken = loginUser.body.token;
    userId = loginUser.body.user.id;

    // 注册用户2
    await request(app).post('/api/auth/register').send({ username: 'review_user2', password: '123', role: 'user' });
    const loginUser2 = await request(app).post('/api/auth/login').send({ username: 'review_user2', password: '123' });
    user2Token = loginUser2.body.token;
    user2Id = loginUser2.body.user.id;

    // 创建酒店
    const hotel = await Hotel.create({
      merchantId: merchantId,
      name: '评价测试酒店',
      city: '深圳',
      address: '南山区',
      starRating: 4,
      price: 600,
      location: { type: 'Point', coordinates: [114.0, 22.5] },
      status: 1
    });
    hotelId = hotel._id;
  });

  beforeEach(async () => {
    await Review.deleteMany({});
    // 重置酒店评分
    await Hotel.findByIdAndUpdate(hotelId, { score: 5 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 发表评价 (POST /api/reviews)
  // ==========================================
  describe('POST /api/reviews (发表评价)', () => {

    it('1.1 发表成功：返回 201', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          rating: 4,
          content: '酒店很干净，服务态度很好！'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.msg).toBe('评价发布成功');
    });

    it('1.2 评价后自动更新酒店平均分', async () => {
      // 用户1评价5分
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ hotelId: hotelId, rating: 5, content: '满分好评！' });

      // 用户2评价3分
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ hotelId: hotelId, rating: 3, content: '一般般吧' });

      // 酒店平均分应该是 (5+3)/2 = 4
      const hotel = await Hotel.findById(hotelId);
      expect(hotel.score).toBe(4);
    });

    it('1.3 参数缺失：缺少评分', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          content: '没有评分'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe('评分不能为空');
    });

    it('1.4 参数缺失：缺少内容', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          rating: 5
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe('评价内容不能为空');
    });

    it('1.5 重复评价：同一用户对同一酒店只能评价一次', async () => {
      // 第一次评价
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ hotelId: hotelId, rating: 5, content: '第一次评价' });

      // 第二次评价
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ hotelId: hotelId, rating: 4, content: '第二次评价' });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe('数据已存在');
    });

    it('1.6 评分范围校验', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          rating: 6, // 超出范围
          content: '超出评分范围'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  // ==========================================
  // 2. 获取评价列表 (GET /api/reviews/:hotelId)
  // ==========================================
  describe('GET /api/reviews/:hotelId (获取评价)', () => {

    beforeEach(async () => {
      // 创建一些测试评价
      await Review.create({
        userId: userId,
        hotelId: hotelId,
        rating: 5,
        content: '非常棒的酒店！'
      });

      await Review.create({
        userId: user2Id,
        hotelId: hotelId,
        rating: 4,
        content: '还不错'
      });
    });

    it('2.1 获取成功：返回评价列表', async () => {
      const res = await request(app).get(`/api/reviews/${hotelId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('2.2 评价列表按时间倒序排列', async () => {
      const res = await request(app).get(`/api/reviews/${hotelId}`);

      expect(res.statusCode).toBe(200);
      // 后创建的评价应该在前面
      const dates = res.body.map(r => new Date(r.createdAt));
      expect(dates[0] >= dates[1]).toBe(true);
    });

    it('2.3 空酒店返回空数组', async () => {
      const fakeHotelId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/reviews/${fakeHotelId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(0);
    });
  });

  // ==========================================
  // 3. 附加测试 (Additional Tests)
  // ==========================================
  describe('附加测试', () => {

    it('3.1 评价包含用户信息 (populate 测试)', async () => {
      // 先创建评价
      await Review.create({
        userId: userId,
        hotelId: hotelId,
        rating: 5,
        content: '测试 populate'
      });

      const res = await request(app).get(`/api/reviews/${hotelId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      // 检查用户信息是否被填充
      expect(res.body[0].userId).toBeDefined();
    });

    it('3.2 无认证发评价返回 401', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .send({ hotelId: hotelId, rating: 5, content: '无认证测试' });

      expect(res.statusCode).toBe(401);
    });
  });
});
