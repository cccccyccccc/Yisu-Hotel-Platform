// tests/test_different_routes/promotions.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const Promotion = require('../../models/Promotion');

jest.setTimeout(30000);

describe('促销模块路由测试 (Promotion Routes)', () => {

  let merchantToken, adminToken, userToken;
  let merchantId;
  let hotelId;
  let promotionId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_promotions';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Promotion.deleteMany({});

    // 注册商户
    await request(app).post('/api/auth/register').send({ username: 'promo_mer', password: '123', role: 'merchant' });
    const loginMer = await request(app).post('/api/auth/login').send({ username: 'promo_mer', password: '123' });
    merchantToken = loginMer.body.token;
    merchantId = loginMer.body.user._id;

    // 注册管理员
    await request(app).post('/api/auth/register').send({ username: 'promo_admin', password: '123', role: 'admin' });
    const loginAdmin = await request(app).post('/api/auth/login').send({ username: 'promo_admin', password: '123' });
    adminToken = loginAdmin.body.token;

    // 注册普通用户
    await request(app).post('/api/auth/register').send({ username: 'promo_user', password: '123', role: 'user' });
    const loginUser = await request(app).post('/api/auth/login').send({ username: 'promo_user', password: '123' });
    userToken = loginUser.body.token;

    // 创建测试酒店
    const hotel = await Hotel.create({
      merchantId: merchantId,
      name: '促销测试酒店',
      city: '上海',
      address: '测试路',
      starRating: 4,
      price: 500,
      location: { type: 'Point', coordinates: [121.4, 31.2] },
      status: 1
    });
    hotelId = hotel._id.toString();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 创建促销 (POST /api/promotions)
  // ==========================================
  describe('POST /api/promotions (创建促销)', () => {

    it('1.1 成功创建折扣促销', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          hotelId: hotelId,
          title: '新年8折优惠',
          description: '新年期间全场8折',
          type: 'discount',
          discountValue: 0.8,
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.title).toBe('新年8折优惠');
      expect(res.body.data.type).toBe('discount');
      expect(res.body.data.discountValue).toBe(0.8);
      promotionId = res.body.data._id;
    });

    it('1.2 成功创建满减促销', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          hotelId: hotelId,
          title: '满500减50',
          type: 'amount_off',
          discountValue: 50,
          minAmount: 500,
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.type).toBe('amount_off');
      expect(res.body.data.minAmount).toBe(500);
    });

    it('1.3 成功创建特价促销', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          hotelId: hotelId,
          title: '特价房299',
          type: 'fixed_price',
          discountValue: 299,
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.type).toBe('fixed_price');
      expect(res.body.data.discountValue).toBe(299);
    });

    it('1.4 权限拒绝：普通用户无法创建', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotelId: hotelId,
          title: '测试促销',
          type: 'discount',
          discountValue: 0.9,
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        });

      expect(res.statusCode).toBe(403);
    });

    it('1.5 参数验证：折扣值无效', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          hotelId: hotelId,
          title: '无效折扣',
          type: 'discount',
          discountValue: 1.5, // 无效：应在0.1-0.99之间
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        });

      expect(res.statusCode).toBe(400);
    });

    it('1.6 参数验证：日期无效', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          hotelId: hotelId,
          title: '日期无效促销',
          type: 'discount',
          discountValue: 0.8,
          startDate: '2026-12-31',
          endDate: '2026-01-01' // 结束日期早于开始日期
        });

      expect(res.statusCode).toBe(400);
    });
  });

  // ==========================================
  // 2. 获取促销列表
  // ==========================================
  describe('GET /api/promotions', () => {

    it('2.1 获取酒店促销列表', async () => {
      const res = await request(app)
        .get(`/api/promotions/hotel/${hotelId}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('2.2 商户获取我的促销', async () => {
      const res = await request(app)
        .get('/api/promotions/my')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('2.3 普通用户无法获取商户促销', async () => {
      const res = await request(app)
        .get('/api/promotions/my')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // ==========================================
  // 3. 更新促销 (PUT /api/promotions/:id)
  // ==========================================
  describe('PUT /api/promotions/:id (更新)', () => {

    it('3.1 成功更新促销', async () => {
      const res = await request(app)
        .put(`/api/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          title: '更新后的促销名称',
          discountValue: 0.7
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.title).toBe('更新后的促销名称');
    });

    it('3.2 切换促销状态', async () => {
      const res = await request(app)
        .put(`/api/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 0 }); // 下线

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe(0);
    });

    it('3.3 权限拒绝：非本人无法更新', async () => {
      // 创建另一个商户
      await request(app).post('/api/auth/register').send({ username: 'other_promo_mer', password: '123', role: 'merchant' });
      const otherLogin = await request(app).post('/api/auth/login').send({ username: 'other_promo_mer', password: '123' });

      const res = await request(app)
        .put(`/api/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${otherLogin.body.token}`)
        .send({ title: '尝试修改' });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==========================================
  // 4. 删除促销 (DELETE /api/promotions/:id)
  // ==========================================
  describe('DELETE /api/promotions/:id (删除)', () => {

    it('4.1 权限拒绝：普通用户无法删除', async () => {
      const res = await request(app)
        .delete(`/api/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('4.2 成功删除促销', async () => {
      const res = await request(app)
        .delete(`/api/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('4.3 删除不存在的促销返回404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/promotions/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
