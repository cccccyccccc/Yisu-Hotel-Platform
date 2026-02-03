const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const app = require('../app'); // 导入你的 Express App

// 引入模型以便清空数据
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Order = require('../models/Order');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');
const Banner = require('../models/Banner'); // <--- 新增 Banner 模型

// === 全局变量 (用于在不同测试步骤间传递数据) ===
let adminToken, merchantToken, userToken;
let merchantId, userId;
let hotelId, roomTypeId, orderId, bannerId;

// === 环境准备 ===
beforeAll(async () => {
    // 1. 连接测试数据库
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-flow';
    await mongoose.connect(TEST_URI);

    // 2. 清空所有表 (保证环境纯净)
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await RoomType.deleteMany({});
    await Order.deleteMany({});
    await Favorite.deleteMany({});
    await Review.deleteMany({});
    await Banner.deleteMany({});
    await Hotel.syncIndexes();
});

afterAll(async () => {
    await mongoose.connection.close();
});

// ==========================================
// 第一章：用户系统与角色准备 (Auth & Users)
// ==========================================
describe('第一章：角色注册与登录', () => {

    it('1.1 注册并登录管理员 (Admin)', async () => {
        // 注册
        await request(app).post('/api/auth/register').send({
            username: 'admin_01', password: 'password123', role: 'admin'
        }).expect(201);

        // 登录
        const res = await request(app).post('/api/auth/login').send({
            username: 'admin_01', password: 'password123'
        }).expect(200);

        adminToken = res.body.token;
        expect(adminToken).toBeDefined();
    });

    it('1.2 注册并登录商户 (Merchant)', async () => {
        await request(app).post('/api/auth/register').send({
            username: 'merchant_01', password: 'password123', role: 'merchant'
        }).expect(201);

        const res = await request(app).post('/api/auth/login').send({
            username: 'merchant_01', password: 'password123'
        });
        merchantToken = res.body.token;
        merchantId = res.body.user.id;
        expect(merchantToken).toBeDefined();
    });

    it('1.3 注册并登录普通用户 (User)', async () => {
        await request(app).post('/api/auth/register').send({
            username: 'user_01', password: 'password123', role: 'user'
        }).expect(201);

        const res = await request(app).post('/api/auth/login').send({
            username: 'user_01', password: 'password123'
        });
        userToken = res.body.token;
        userId = res.body.user.id;
        expect(userToken).toBeDefined();
    });

    it('1.4 用户修改个人资料 (Profile)', async () => {
        const res = await request(app)
            .put('/api/users/profile')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                gender: 'female',
                bio: '我是爱旅游的测试员',
                avatar: '/uploads/avatar_test.jpg'
            })
            .expect(200);

        expect(res.body.gender).toBe('female');
    });
});

// ==========================================
// 第二章：商户发布与管理 (Hotels & Rooms)
// ==========================================
describe('第二章：商户业务 (发布与房型)', () => {

    it('2.1 图片上传测试 (Mock Upload)', async () => {
        const buffer = Buffer.from('fake image content');
        const res = await request(app)
            .post('/api/upload')
            .attach('file', buffer, 'test.jpg')
            .expect(200);

        expect(res.body).toHaveProperty('url');
        expect(res.body.url).toMatch(/^\/uploads\//);
    });

    it('2.2 商户发布新酒店 (含地理位置)', async () => {
        const res = await request(app)
            .post('/api/hotels')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send({
                name: '测试大酒店',
                nameEn: 'Test Grand Hotel',
                city: '上海',
                address: '南京东路888号',
                starRating: 5,
                price: 800,
                description: '这是一个测试酒店',
                tags: ['豪华', '地铁口'],
                // === 新增：地理坐标 (上海人民广场附近) ===
                location: {
                    type: 'Point',
                    coordinates: [121.4737, 31.2304] // [经度, 纬度]
                }
            })
            .expect(200);

        hotelId = res.body._id;
        expect(res.body.status).toBe(0);
        // 确保 location 被正确保存
        expect(res.body.location.coordinates[0]).toBe(121.4737);
    });

    it('2.3 商户为酒店添加房型', async () => {
        const res = await request(app)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send({
                hotelId: hotelId,
                title: '豪华江景房',
                price: 1200,
                stock: 5,
                capacity: 2
            })
            .expect(200);

        roomTypeId = res.body._id;
    });

    it('2.4 商户查看自己的酒店列表', async () => {
        const res = await request(app)
            .get('/api/hotels/my')
            .set('Authorization', `Bearer ${merchantToken}`)
            .expect(200);

        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].name).toBe('测试大酒店');
    });
});

// ==========================================
// 第三章：管理员审核 (Admin Audit)
// ==========================================
describe('第三章：管理员审核', () => {

    it('3.1 管理员查看待审核列表并通过', async () => {
        await request(app)
            .put(`/api/hotels/${hotelId}/audit`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 1 })
            .expect(200);

        const hotel = await Hotel.findById(hotelId);
        expect(hotel.status).toBe(1);
    });
});

// ==========================================
// 第四章：用户交互 (Search & Favorite)
// ==========================================
describe('第四章：用户搜索与收藏', () => {

    it('4.1 用户搜索酒店 (价格排序)', async () => {
        const res = await request(app)
            .get('/api/hotels')
            .query({ city: '上海', sortType: 'price_asc', page: 1, limit: 10 })
            .expect(200);

        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe('测试大酒店');
    });

    it('4.2 用户搜索酒店 (距离排序 LBS)', async () => {
        // 模拟用户在上海 (坐标略有偏差，计算距离)
        const res = await request(app)
            .get('/api/hotels')
            .query({
                sortType: 'distance',
                userLng: 121.4700,
                userLat: 31.2300,
                page: 1, limit: 10
            })
            .expect(200);

        // 应该能搜到刚才发布的酒店（因为它在附近）
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0]._id).toBe(hotelId);
    });

    it('4.3 用户收藏酒店', async () => {
        await request(app)
            .post(`/api/favorites/${hotelId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(201);

        const res = await request(app)
            .get(`/api/favorites/check/${hotelId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.isFavorite).toBe(true);
    });

    it('4.4 用户取消收藏', async () => {
        await request(app)
            .delete(`/api/favorites/${hotelId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        const res = await request(app)
            .get(`/api/favorites/check/${hotelId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.body.isFavorite).toBe(false);
    });
});

// ==========================================
// 第五章：交易流程 (Order & Inventory)
// ==========================================
describe('第五章：下单与库存', () => {

    it('5.1 用户下单预订 (原子操作测试)', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                hotelId,
                roomTypeId,
                checkInDate: '2026-05-01',
                checkOutDate: '2026-05-03',
                quantity: 1
            })
            .expect(200);

        orderId = res.body._id;
        expect(res.body.totalPrice).toBe(2400);
    });

    it('5.2 验证库存自动扣减', async () => {
        const room = await RoomType.findById(roomTypeId);
        // 初始是5，买了一间，应该是4
        expect(room.stock).toBe(4);
    });

    it('5.3 用户查看我的订单', async () => {
        const res = await request(app)
            .get('/api/orders/my')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.length).toBe(1);
        expect(res.body[0].status).toBe('paid');
    });

    it('5.4 用户取消订单 (库存应自动回退)', async () => {
        await request(app)
            .put(`/api/orders/${orderId}/cancel`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        // 验证状态
        const order = await Order.findById(orderId);
        expect(order.status).toBe('cancelled');

        // 验证库存回退 (4 -> 5)
        const room = await RoomType.findById(roomTypeId);
        expect(room.stock).toBe(5);
    });
});

// ==========================================
// 第六章：评价与评分 (Reviews & Score)
// ==========================================
describe('第六章：评价闭环', () => {

    it('6.1 用户评价酒店', async () => {
        await request(app)
            .post('/api/reviews')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                hotelId,
                rating: 5,
                content: '非常棒的体验，下次还来！'
            })
            .expect(201);
    });

    it('6.2 验证酒店评分自动更新', async () => {
        const hotel = await Hotel.findById(hotelId);
        expect(hotel.score).toBe(5);
    });

    it('6.3 查看酒店评价列表', async () => {
        const res = await request(app)
            .get(`/api/reviews/${hotelId}`)
            .expect(200);

        expect(res.body.length).toBe(1);
        expect(res.body[0].content).toBe('非常棒的体验，下次还来！');
    });
});

// ==========================================
// 第七章：Banner 管理 (Admin Only)
// ==========================================
describe('第七章：Banner 管理', () => {

    it('7.1 管理员发布轮播图', async () => {
        const res = await request(app)
            .post('/api/banners')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                imageUrl: '/uploads/banner1.jpg',
                targetHotelId: hotelId,
                title: '五一特惠',
                priority: 10
            })
            .expect(201);

        bannerId = res.body._id;
        expect(res.body.title).toBe('五一特惠');
    });

    it('7.2 普通用户获取首页轮播图', async () => {
        const res = await request(app)
            .get('/api/banners')
            .expect(200);

        expect(res.body.length).toBeGreaterThan(0);
        // 确保关联查询生效
        expect(res.body[0].targetHotelId).toHaveProperty('name');
    });

    it('7.3 管理员删除轮播图', async () => {
        await request(app)
            .delete(`/api/banners/${bannerId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const res = await request(app)
            .get('/api/banners')
            .expect(200);

        // 删完了应该是空的
        expect(res.body.length).toBe(0);
    });
});