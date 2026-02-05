// tests/test_different_routes/banners.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const Banner = require('../../models/Banner');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel'); // 需要创建酒店来获取合法的 targetHotelId

// 设置较长超时
jest.setTimeout(30000);

describe('轮播图模块路由测试 (Banner Routes)', () => {

    let adminToken, userToken;
    let targetHotelId; // 用于测试关联

    // === 环境准备 ===
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_banners';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        // 1. 清理数据
        await User.deleteMany({});
        await Hotel.deleteMany({});
        await Banner.deleteMany({});

        // 2. 准备管理员账号并获取 Token
        await request(app).post('/api/auth/register').send({
            username: 'banner_admin', password: '123', role: 'admin'
        });
        const resAdmin = await request(app).post('/api/auth/login').send({
            username: 'banner_admin', password: '123'
        });
        adminToken = resAdmin.body.token;

        // 3. 准备普通用户账号并获取 Token (用于测试权限不足)
        await request(app).post('/api/auth/register').send({
            username: 'banner_user', password: '123', role: 'user'
        });
        const resUser = await request(app).post('/api/auth/login').send({
            username: 'banner_user', password: '123'
        });
        userToken = resUser.body.token;

        // 4. 创建一个虚拟酒店 (Banner 需要关联 targetHotelId)
        const hotel = await Hotel.create({
            name: '测试关联酒店',
            city: '测试市',
            address: '测试路',
            starRating: 5,
            price: 100,
            location: { type: 'Point', coordinates: [0, 0] },
            merchantId: new mongoose.Types.ObjectId()
        });
        targetHotelId = hotel._id;
    });

    // 每个测试前清空 Banner 表，保证环境独立
    beforeEach(async () => {
        await Banner.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. 测试获取轮播图 (GET /api/banners)
    // ==========================================
    describe('GET /api/banners', () => {

        it('1.1 成功获取：应返回状态为1的轮播图并包含酒店信息', async () => {
            // 准备数据：插入一条上线(1)和一条下线(0)的 Banner
            await Banner.create([
                {
                    imageUrl: 'online.jpg',
                    targetHotelId,
                    title: 'Online Banner',
                    status: 1,
                    priority: 10
                },
                {
                    imageUrl: 'offline.jpg',
                    targetHotelId,
                    title: 'Offline Banner',
                    status: 0, // 下线状态，不应被查出
                    priority: 5
                }
            ]);

            const res = await request(app).get('/api/banners');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1); // 只应该有一个
            expect(res.body[0].title).toBe('Online Banner');

            // 验证 populate 是否生效 (targetHotelId 应该是对象而不是字符串)
            expect(res.body[0].targetHotelId).toHaveProperty('name', '测试关联酒店');
        });

        it('1.2 排序测试：应按 priority 降序排列', async () => {
            await Banner.create([
                { imageUrl: 'p1.jpg', targetHotelId, status: 1, priority: 1 },
                { imageUrl: 'p2.jpg', targetHotelId, status: 1, priority: 100 }
            ]);

            const res = await request(app).get('/api/banners');

            expect(res.body.length).toBe(2);
            expect(res.body[0].priority).toBe(100); // 优先级高的在前
            expect(res.body[1].priority).toBe(1);
        });

        it('1.3 服务器错误：模拟数据库异常返回 500', async () => {
            const spy = jest.spyOn(Banner, 'find').mockImplementationOnce(() => {
                throw new Error('DB Error');
            });

            const res = await request(app).get('/api/banners');
            expect(res.statusCode).toBe(500);

            spy.mockRestore();
        });
    });

    // ==========================================
    // 2. 测试发布轮播图 (POST /api/banners)
    // ==========================================
    describe('POST /api/banners', () => {

        const newBannerData = {
            imageUrl: '/uploads/new.jpg',
            title: 'New Activity',
            priority: 99
        };

        it('2.1 权限拒绝：普通用户尝试创建应返回 403', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${userToken}`) // 普通用户
                .send({ ...newBannerData, targetHotelId });

            expect(res.statusCode).toBe(403);
            expect(res.body.msg).toBe('只有管理员可以管理轮播图');
        });

        it('2.2 参数缺失：缺少 imageUrl 或 targetHotelId 应返回 400', async () => {
            // 缺少 targetHotelId
            const res1 = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ imageUrl: 'img.jpg' });
            expect(res1.statusCode).toBe(400);

            // 缺少 imageUrl
            const res2 = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ targetHotelId });
            expect(res2.statusCode).toBe(400);
        });

        it('2.3 创建成功：管理员输入有效信息应返回 201', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...newBannerData, targetHotelId });

            expect(res.statusCode).toBe(201);
            expect(res.body.title).toBe('New Activity');

            // 验证数据库
            const dbBanner = await Banner.findById(res.body._id);
            expect(dbBanner).toBeTruthy();
            expect(dbBanner.targetHotelId.toString()).toBe(targetHotelId.toString());
        });

        it('2.4 默认值测试：不传 priority 应默认为 0', async () => {
            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    imageUrl: 'default.jpg',
                    targetHotelId
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.priority).toBe(0);
        });

        it('2.5 服务器错误：模拟 save 异常返回 500', async () => {
            // Mock Banner.prototype.save
            const spy = jest.spyOn(Banner.prototype, 'save').mockImplementationOnce(() => {
                throw new Error('Save Error');
            });

            const res = await request(app)
                .post('/api/banners')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...newBannerData, targetHotelId });

            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });

    // ==========================================
    // 3. 测试删除轮播图 (DELETE /api/banners/:id)
    // ==========================================
    describe('DELETE /api/banners/:id', () => {

        let bannerToDelete;

        beforeEach(async () => {
            // 每次测试前创建一个待删除的 Banner
            bannerToDelete = await Banner.create({
                imageUrl: 'del.jpg',
                targetHotelId,
                title: 'To Delete'
            });
        });

        it('3.1 权限拒绝：普通用户删除应返回 403', async () => {
            const res = await request(app)
                .delete(`/api/banners/${bannerToDelete._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(403);
            // 确认未被删除
            const check = await Banner.findById(bannerToDelete._id);
            expect(check).not.toBeNull();
        });

        it('3.2 删除成功：管理员删除应返回 200', async () => {
            const res = await request(app)
                .delete(`/api/banners/${bannerToDelete._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.msg).toBe('删除成功');

            // 确认数据库已删除
            const check = await Banner.findById(bannerToDelete._id);
            expect(check).toBeNull();
        });

        it('3.3 资源不存在：删除不存在的 ID 应返回 404', async () => {
            // 先删除，再删一次
            await Banner.findByIdAndDelete(bannerToDelete._id);

            const res = await request(app)
                .delete(`/api/banners/${bannerToDelete._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.msg).toBe('轮播图不存在');
        });

        it('3.4 服务器错误：模拟数据库异常返回 500', async () => {
            const spy = jest.spyOn(Banner, 'findByIdAndDelete').mockImplementationOnce(() => {
                throw new Error('Delete Error');
            });

            const res = await request(app)
                .delete(`/api/banners/${bannerToDelete._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });
});