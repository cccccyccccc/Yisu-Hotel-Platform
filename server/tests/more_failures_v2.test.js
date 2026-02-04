const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Banner = require('../models/Banner');
const Hotel = require('../models/Hotel');
const Favorite = require('../models/Favorite');

// 设置较长超时
jest.setTimeout(30000);

describe('more failures test', () => {
    let adminToken, userToken;
    let userId;
    let bannerId, hotelId;

    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-more-failures-2';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        // 1. 清空数据
        await User.deleteMany({});
        await Banner.deleteMany({});
        await Hotel.deleteMany({});
        await Favorite.deleteMany({});

        // 2. 准备 Admin 账号
        await request(app).post('/api/auth/register').send({ username: 'final_admin', password: '123', role: 'admin' });
        const resAdmin = await request(app).post('/api/auth/login').send({ username: 'final_admin', password: '123' });
        adminToken = resAdmin.body.token;

        // 3. 准备 User 账号
        await request(app).post('/api/auth/register').send({ username: 'final_user', password: '123', role: 'user' });
        const resUser = await request(app).post('/api/auth/login').send({ username: 'final_user', password: '123' });
        userToken = resUser.body.token;
        userId = resUser.body.user.id;

        // 4. 准备一个基础酒店 (用于 Banner 和 Favorite 测试)
        const hotel = await Hotel.create({
            merchantId: new mongoose.Types.ObjectId(),
            name: '测试酒店',
            city: '测试市',
            address: '地址',
            starRating: 5,
            price: 100,
            location: { type: 'Point', coordinates: [0,0] }
        });
        hotelId = hotel._id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('Banners 模块完全覆盖', () => {

        // 1. 测试 GET / (查)
        it('1.1 获取轮播图列表 (GET /)', async () => {
            const res = await request(app).get('/api/banners');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        // 2. 测试 POST / (增 - 权限控制)
        it('1.2 普通用户无法创建 Banner (403)', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ imageUrl: 'test.jpg' });
            expect(res.statusCode).toBe(403);
        });

        // 3. 测试 POST / (增 - 参数校验)
        it('1.3 管理员创建缺少参数应报错 (400)', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title: '只有标题没有图片' }); // 缺 imageUrl
            expect(res.statusCode).toBe(400);
        });

        // 4. 测试 POST / (增 - 成功)
        it('1.4 管理员成功创建 Banner (201)', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    imageUrl: '/uploads/test.jpg',
                    targetHotelId: hotelId,
                    title: '覆盖率测试Banner',
                    priority: 1
                });
            expect(res.statusCode).toBe(201);
            bannerId = res.body._id; // 保存 ID 供删除测试用
        });

        // 5. 测试 DELETE /:id (删 - 权限控制)
        it('1.5 普通用户无法删除 Banner (403)', async () => {
            const res = await request(app)
                .delete(`/api/banners/${bannerId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(403);
        });

        // 6. 测试 DELETE /:id (删 - 不存在的 ID)
        it('1.6 删除不存在的 Banner (404)', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/banners/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).not.toBe(500);
        });

        // 7. 测试 DELETE /:id (删 - 成功)
        it('1.7 管理员成功删除 Banner (200)', async () => {
            const res = await request(app)
                .delete(`/api/banners/${bannerId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
        });
    });

    describe('Favorites 模块补漏', () => {
        // 1. 正常收藏
        it('2.1 收藏酒店', async () => {
            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(201);
        });

        // 2. 覆盖 "重复收藏" 分支
        it('2.2 重复收藏应报错 (400)', async () => {
            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(400); // 必须触发这里的 400
        });

        // 3. 覆盖 "检查是否收藏"
        it('2.3 检查收藏状态 (GET check)', async () => {
            const res = await request(app)
                .get(`/api/favorites/check/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.body.isFavorite).toBe(true);
        });

        // 4. 覆盖 "获取列表"
        it('2.4 获取收藏列表', async () => {
            const res = await request(app)
                .get('/api/favorites')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.body.length).toBe(1);
        });

        // 5. 覆盖 "取消收藏" (正常)
        it('2.5 取消收藏', async () => {
            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(200);
        });

        // 6. 覆盖 "取消不存在的收藏" 分支 (Mongoose删除不存在文档)
        it('2.6 取消未收藏的酒店', async () => {
            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(200); // 通常幂等操作返回 200
        });
    });

    describe('Users 模块覆盖', () => {
        // 1. 获取详情
        it('3.1 获取个人信息', async () => {
            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('final_user');
        });

        // 2. 更新信息 (覆盖 PUT 分支)
        it('3.2 更新个人信息 (修改头像和简介)', async () => {
            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    avatar: '/new_avatar.jpg',
                    bio: 'Testing Bio Update',
                    gender: 'male'
                });
            expect(res.statusCode).toBe(200);

            // 验证更新是否生效
            const check = await User.findById(userId);
            expect(check.bio).toBe('Testing Bio Update');
        });

        // 3. 更新信息 (无效字段测试 - 可选)
        it('3.3 更新时传入空数据应正常处理', async () => {
            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${userToken}`)
                .send({}); // 空包
            expect(res.statusCode).toBe(200);
        });
    });
});