const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const RoomType = require('../../models/RoomType');
const Banner = require('../../models/Banner');
const Favorite = require('../../models/Favorite');

// 设置较长超时，防止 CI 环境慢导致失败
jest.setTimeout(30000);

describe('补充测试', () => {
    let adminToken, merchantToken, userToken, user2Token;
    let merchantId, userId, user2Id;
    let hotelId, roomId;

    // === 环境准备 ===
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-more-failures-1';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        // 清库
        await User.deleteMany({});
        await Hotel.deleteMany({});
        await RoomType.deleteMany({});
        await Banner.deleteMany({});
        await Favorite.deleteMany({});

        // 1. 注册 Admin
        await request(app).post('/api/auth/register').send({ username: 'cov_admin', password: '123', role: 'admin' });
        const resAdmin = await request(app).post('/api/auth/login').send({ username: 'cov_admin', password: '123' });
        adminToken = resAdmin.body.token;

        // 2. 注册 Merchant (商户A)
        await request(app).post('/api/auth/register').send({ username: 'cov_merchant', password: '123', role: 'merchant' });
        const resMer = await request(app).post('/api/auth/login').send({ username: 'cov_merchant', password: '123' });
        merchantToken = resMer.body.token;
        merchantId = resMer.body.user.id;

        // 3. 注册 User 1
        await request(app).post('/api/auth/register').send({ username: 'cov_user1', password: '123', role: 'user' });
        const resUser = await request(app).post('/api/auth/login').send({ username: 'cov_user1', password: '123' });
        userToken = resUser.body.token;
        userId = resUser.body.user.id;

        // 4. 注册 User 2 (用于测试权限冲突)
        await request(app).post('/api/auth/register').send({ username: 'cov_user2', password: '123', role: 'user' });
        const resUser2 = await request(app).post('/api/auth/login').send({ username: 'cov_user2', password: '123' });
        user2Token = resUser2.body.token;
        user2Id = resUser2.body.user.id;

        // 5. 准备基础数据 (酒店)
        const hotel = await Hotel.create({
            merchantId: merchantId,
            name: '覆盖率大酒店',
            city: '测试市',
            address: '测试路1号',
            starRating: 5,
            price: 500,
            location: { type: 'Point', coordinates: [0, 0] },
            status: 1 // 已发布
        });
        hotelId = hotel._id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('Banners 模块覆盖', () => {
        let bannerId;

        it('1.1 普通用户尝试创建 Banner 应被拒绝 (403)', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ imageUrl: 'test.jpg', targetHotelId: hotelId });
            expect(res.statusCode).toBe(403);
        });

        it('1.2 管理员创建 Banner (正常流程)', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    imageUrl: '/uploads/banner.jpg',
                    targetHotelId: hotelId,
                    title: '测试Banner',
                    priority: 10
                });
            expect(res.statusCode).toBe(201);
            bannerId = res.body._id;
        });

        it('1.3 获取 Banner 列表 (公开接口)', async () => {
            const res = await request(app).get('/api/banners');
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('1.4 普通用户尝试删除 Banner 应被拒绝 (403)', async () => {
            const res = await request(app)
                .delete(`/api/banners/${bannerId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(403);
        });

        it('1.5 管理员删除 Banner (正常流程)', async () => {
            const res = await request(app)
                .delete(`/api/banners/${bannerId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
        });

        it('1.6 管理员删除不存在的 Banner (404/200)', async () => {
            // 视具体实现，可能返回 404 或 200(删除成功)
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/banners/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            // 只要不报错(500)就行
            expect(res.statusCode).not.toBe(500);
        });
    });

    // ==========================================
    // 2. 针对 favorites.js (22% -> 80%+)
    // ==========================================
    describe('Favorites 模块覆盖', () => {
        it('2.1 收藏酒店 (正常流程)', async () => {
            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(201);
        });

        it('2.2 重复收藏同一酒店 (分支测试)', async () => {
            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            // 你的逻辑可能返回 400 (已收藏)
            expect(res.statusCode).toBe(400);
        });

        it('2.3 收藏不存在的酒店 (异常处理)', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/favorites/${fakeId}`)
                .set('Authorization', `Bearer ${userToken}`);
            // 视逻辑而定，可能 404
            expect(res.statusCode).toBe(404);
        });

        it('2.4 获取收藏列表', async () => {
            const res = await request(app)
                .get('/api/favorites')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
        });

        it('2.5 检查是否收藏 (Check接口)', async () => {
            const res = await request(app)
                .get(`/api/favorites/check/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.body.isFavorite).toBe(true);
        });

        it('2.6 取消收藏 (正常流程)', async () => {
            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(200);
        });

        it('2.7 取消未收藏的酒店 (幂等性测试)', async () => {
            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            // 通常是 200 或 404，视具体实现
            expect(res.statusCode).not.toBe(500);
        });
    });

    // ==========================================
    // 3. 针对 users.js (Profile 更新逻辑)
    // ==========================================
    describe('Users 模块覆盖', () => {
        it('3.1 获取个人信息', async () => {
            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('cov_user1');
        });

        it('3.2 修改个人信息 (性别/简介/头像)', async () => {
            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    gender: 'female',
                    bio: 'Testing Bio',
                    avatar: '/uploads/new.jpg'
                });
            expect(res.statusCode).toBe(200);

            // 验证修改结果
            const check = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${userToken}`);
            expect(check.body.bio).toBe('Testing Bio');
        });
    });

    // ==========================================
    // 4. 针对 rooms.js (权限与边界测试)
    // ==========================================
    describe('Rooms 模块权限与边界', () => {
        // 先由 商户A 创建一个房型
        it('4.1 商户创建房型', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({
                    hotelId: hotelId,
                    title: '测试房型',
                    price: 200,
                    stock: 5
                });
            expect(res.statusCode).toBe(200);
            roomId = res.body._id;
        });

        it('4.2 非法用户(普通用户)尝试修改房型 (403)', async () => {
            const res = await request(app)
                .put(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${userToken}`) // 普通用户
                .send({ price: 9999 });
            expect(res.statusCode).toBe(403);
        });

        it('4.3 越权修改: 商户B 尝试修改 商户A 的房型 (403)', async () => {
            // 注册一个新的商户B
            await request(app).post('/api/auth/register').send({ username: 'merchant_b', password: '123', role: 'merchant' });
            const resLogin = await request(app).post('/api/auth/login').send({ username: 'merchant_b', password: '123' });
            const tokenB = resLogin.body.token;

            const res = await request(app)
                .put(`/api/rooms/${roomId}`) // roomId 属于 商户A
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ price: 100 });

            // 你的代码应该检查 hotel.merchantId === req.user.userId
            expect(res.statusCode).toBe(403);
        });

        it('4.4 修改不存在的房型 (404)', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/rooms/${fakeId}`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ price: 300 });
            expect(res.statusCode).toBe(404);
        });

        it('4.5 越权删除: 商户B 尝试删除 商户A 的房型 (403)', async () => {
            // 重新登录商户B
            const resLogin = await request(app).post('/api/auth/login').send({ username: 'merchant_b', password: '123' });
            const tokenB = resLogin.body.token;

            const res = await request(app)
                .delete(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${tokenB}`);
            expect(res.statusCode).toBe(403);
        });

        it('4.6 商户A 成功删除自己的房型', async () => {
            const res = await request(app)
                .delete(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${merchantToken}`);
            expect(res.statusCode).toBe(200);
        });
    });
});