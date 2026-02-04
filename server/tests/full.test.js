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
const Banner = require('../models/Banner');

// === 全局变量 ===
let adminToken, merchantToken, userToken;
let merchantId, userId;
let hotelId, roomTypeId, orderId, bannerId;

// === 环境准备 ===
beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-flow';
    await mongoose.connect(TEST_URI);

    // 清空所有表
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
// 第一章：用户系统与角色准备
// ==========================================
describe('第一章：角色注册与登录', () => {
    it('1.1 注册并登录管理员 (Admin)', async () => {
        await request(app).post('/api/auth/register').send({
            username: 'admin_01', password: 'password123', role: 'admin'
        }).expect(201);
        const res = await request(app).post('/api/auth/login').send({
            username: 'admin_01', password: 'password123'
        }).expect(200);
        adminToken = res.body.token;
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
    });
});

// ==========================================
// 第二章：商户发布与管理 (Hotels & Rooms)
// ==========================================
describe('第二章：商户业务 (发布与房型)', () => {
    it('2.1 商户发布新酒店 (含Tags)', async () => {
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
                tags: ['亲子', '免费停车', '健身房'], // [关键] 添加标签用于后续测试
                location: {
                    type: 'Point',
                    coordinates: [121.4737, 31.2304]
                }
            })
            .expect(200);
        hotelId = res.body._id;
    });

    it('2.2 商户为酒店添加房型', async () => {
        const res = await request(app)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send({
                hotelId: hotelId,
                title: '豪华江景房',
                price: 1000,
                stock: 2, // 这里的库存很少，用于测试“满房”逻辑
                capacity: 2
            })
            .expect(200);
        roomTypeId = res.body._id;
    });

    // [覆盖率提升] 测试房型修改 (PUT)
    it('2.3 商户修改房型信息 (PUT /api/rooms/:id)', async () => {
        const res = await request(app)
            .put(`/api/rooms/${roomTypeId}`)
            .set('Authorization', `Bearer ${merchantToken}`)
            .send({
                title: '至尊江景房', // 修改名称
                price: 1200          // 修改价格
            })
            .expect(200);

        expect(res.body.title).toBe('至尊江景房');
        expect(res.body.price).toBe(1200);
    });
});

// ==========================================
// 第三章：管理员审核
// ==========================================
describe('第三章：管理员审核', () => {
    it('3.1 审核通过', async () => {
        await request(app)
            .put(`/api/hotels/${hotelId}/audit`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 1 })
            .expect(200);
    });
});

// ==========================================
// 第四章：用户交互与搜索 (Search)
// ==========================================
describe('第四章：高级搜索功能', () => {

    it('4.1 基础搜索 (城市)', async () => {
        const res = await request(app)
            .get('/api/hotels')
            .query({ city: '上海' })
            .expect(200);
        expect(res.body.data.length).toBe(1);
    });

    // [覆盖率提升] 测试 Tags 筛选
    it('4.2 快捷标签筛选 (Tags)', async () => {
        // 1. 搜索存在的标签
        const res1 = await request(app)
            .get('/api/hotels')
            .query({ tags: '亲子,免费停车' }) // 酒店有这两个标签
            .expect(200);
        expect(res1.body.data.length).toBe(1);

        // 2. 搜索不存在的标签
        const res2 = await request(app)
            .get('/api/hotels')
            .query({ tags: '亲子,游泳池' }) // 酒店没有游泳池
            .expect(200);
        expect(res2.body.data.length).toBe(0);
    });
});

// ==========================================
// 第五章：交易与库存 (Order)
// ==========================================
describe('第五章：下单与库存', () => {
    it('5.1 用户下单 (消耗库存)', async () => {
        // 预订 2026-10-01 到 2026-10-03 (2晚)
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                hotelId,
                roomTypeId,
                checkInDate: '2026-10-01',
                checkOutDate: '2026-10-03',
                quantity: 2 // 酒店总库存是2，这单把库存下满了
            })
            .expect(200);
        orderId = res.body._id;
    });

    // [覆盖率提升] 测试日期可用性筛选
    it('5.2 日期搜索：满房验证', async () => {
        // 刚才的订单把 10-01 到 10-03 的房型占满了 (库存2, 订了2)

        // 1. 搜这段时间，应该搜不到
        const res1 = await request(app)
            .get('/api/hotels')
            .query({
                checkInDate: '2026-10-01',
                checkOutDate: '2026-10-02'
            })
            .expect(200);
        expect(res1.body.data.length).toBe(0); // 应该为空

        // 2. 搜其他时间，应该能搜到
        const res2 = await request(app)
            .get('/api/hotels')
            .query({
                checkInDate: '2026-11-01',
                checkOutDate: '2026-11-02'
            })
            .expect(200);
        expect(res2.body.data.length).toBe(1); // 有房
    });
});

// ==========================================
// 第八章：进阶功能 (价格日历) [新增章节]
// ==========================================
describe('第八章：价格日历 (复杂功能)', () => {

    // [覆盖率提升] 设置价格日历
    it('8.1 商户设置特殊日期价格 (PUT calendar)', async () => {
        const res = await request(app)
            .put(`/api/rooms/${roomTypeId}/calendar`)
            .set('Authorization', `Bearer ${merchantToken}`)
            .send({
                calendarData: [
                    { date: '2026-12-25', price: 2000, stock: 5 }, // 圣诞节涨价
                    { date: '2026-12-31', price: 3000 }            // 跨年夜涨价
                ]
            })
            .expect(200);

        expect(res.body.priceCalendar.length).toBe(2);
    });

    // [覆盖率提升] 获取价格日历
    it('8.2 用户获取价格日历 (GET calendar)', async () => {
        const res = await request(app)
            .get(`/api/rooms/${roomTypeId}/calendar`)
            .expect(200);

        expect(res.body.basePrice).toBe(1200); // 之前修改后的基础价
        expect(res.body.calendar.length).toBe(2);

        // 验证具体数据
        const christmas = res.body.calendar.find(d => d.date === '2026-12-25');
        expect(christmas.price).toBe(2000);
    });
});