// tests/test_different_routes/messages.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const Order = require('../../models/Order');
const RoomType = require('../../models/RoomType');
const Message = require('../../models/Message');

jest.setTimeout(30000);

describe('消息模块路由测试 (Message Routes)', () => {

  let merchantToken, userToken;
  let merchantId, userId;
  let hotelId;

  // === 环境准备 ===
  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_messages';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI);
    }

    // 清空数据
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Order.deleteMany({});
    await Message.deleteMany({});

    // 注册商户
    await request(app).post('/api/auth/register').send({ username: 'msg_merchant', password: '123', role: 'merchant' });
    const loginMer = await request(app).post('/api/auth/login').send({ username: 'msg_merchant', password: '123' });
    merchantToken = loginMer.body.token;
    merchantId = loginMer.body.user._id;

    // 注册普通用户
    await request(app).post('/api/auth/register').send({ username: 'msg_user', password: '123', role: 'user' });
    const loginUser = await request(app).post('/api/auth/login').send({ username: 'msg_user', password: '123' });
    userToken = loginUser.body.token;
    userId = loginUser.body.user._id;

    // 创建测试酒店
    const hotel = await Hotel.create({
      merchantId: merchantId,
      name: '消息测试酒店',
      city: '北京',
      address: '测试路1号',
      starRating: 4,
      price: 300,
      location: { type: 'Point', coordinates: [116.4, 39.9] },
      status: 1
    });
    hotelId = hotel._id.toString();

    // 创建房型
    const roomType = await RoomType.create({
      hotelId: hotelId,
      title: '标准间',
      price: 300,
      stock: 5
    });

    // 创建订单关系（用户在商户酒店下单）
    await Order.create({
      userId: userId,
      hotelId: hotelId,
      roomTypeId: roomType._id,
      checkInDate: new Date(),
      checkOutDate: new Date(Date.now() + 86400000),
      totalPrice: 300,
      status: 'paid'
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. 发送消息 (POST /api/messages)
  // ==========================================
  describe('POST /api/messages (发送消息)', () => {

    it('1.1 用户发送消息给商户成功', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receiverId: merchantId,
          content: '您好，请问房间价格是多少？'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.content).toBe('您好，请问房间价格是多少？');
      expect(res.body.senderId).toBeDefined();
    });

    it('1.2 商户回复用户消息成功', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          receiverId: userId,
          content: '您好，房间300元/晚'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.content).toBe('您好，房间300元/晚');
    });

    it('1.3 缺少参数：返回400', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ receiverId: merchantId });

      expect(res.statusCode).toBe(400);
    });

    it('1.4 接收者不存在：返回404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receiverId: fakeId,
          content: '测试消息'
        });

      expect(res.statusCode).toBe(404);
    });

    it('1.5 商户无订单关系时不能发消息', async () => {
      // 注册另一个用户（没有订单关系）
      await request(app).post('/api/auth/register').send({ username: 'no_order_user', password: '123', role: 'user' });
      const loginNew = await request(app).post('/api/auth/login').send({ username: 'no_order_user', password: '123' });

      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          receiverId: loginNew.body.user._id,
          content: '您好'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==========================================
  // 2. 获取聊天记录 (GET /api/messages/:userId)
  // ==========================================
  describe('GET /api/messages/:userId (获取聊天记录)', () => {

    it('2.1 获取与商户的聊天记录', async () => {
      const res = await request(app)
        .get(`/api/messages/${merchantId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // 3. 获取会话列表 (GET /api/messages/conversations)
  // ==========================================
  describe('GET /api/messages/conversations (会话列表)', () => {

    it('3.1 用户获取会话列表', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('3.2 商户获取会话列表', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==========================================
  // 4. 获取联系人列表 (GET /api/messages/contacts)
  // ==========================================
  describe('GET /api/messages/contacts (联系人列表)', () => {

    it('4.1 用户获取可联系的商户列表', async () => {
      const res = await request(app)
        .get('/api/messages/contacts')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('4.2 商户获取可联系的用户列表', async () => {
      const res = await request(app)
        .get('/api/messages/contacts')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==========================================
  // 5. 获取未读消息数 (GET /api/messages/unread/count)
  // ==========================================
  describe('GET /api/messages/unread/count (未读消息数)', () => {

    it('5.1 获取未读消息数量', async () => {
      const res = await request(app)
        .get('/api/messages/unread/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });
});
