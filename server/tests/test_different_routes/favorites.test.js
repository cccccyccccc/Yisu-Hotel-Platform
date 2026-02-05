// tests/test_different_routes/favorites.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const Favorite = require('../../models/Favorite');

// 设置较长超时
jest.setTimeout(30000);

describe('收藏夹模块路由测试 (Favorite Routes)', () => {

    let token;
    let userId;
    let hotelId;

    // === 环境准备 ===
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_favorites';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        // 1. 清理数据
        await User.deleteMany({});
        await Hotel.deleteMany({});
        await Favorite.deleteMany({});

        // 2. 注册并登录获取 Token
        await request(app).post('/api/auth/register').send({
            username: 'fav_user', password: '123', role: 'user'
        });
        const resLogin = await request(app).post('/api/auth/login').send({
            username: 'fav_user', password: '123'
        });
        token = resLogin.body.token;
        userId = resLogin.body.user.id;

        // 3. 创建一个测试酒店
        const hotel = await Hotel.create({
            name: '收藏测试酒店',
            city: '北京',
            address: '三环',
            starRating: 5,
            price: 500,
            location: { type: 'Point', coordinates: [0, 0] },
            merchantId: new mongoose.Types.ObjectId()
        });
        hotelId = hotel._id;
    });

    // 每个测试前不完全清空，部分依赖上下文，但为了独立性，我们在具体用例里控制数据
    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. 测试收藏酒店 (POST /api/favorites/:hotelId)
    // ==========================================
    describe('POST /api/favorites/:hotelId', () => {

        // 在测试前先清空收藏表
        beforeEach(async () => await Favorite.deleteMany({}));

        it('1.1 成功收藏：输入有效ID应返回 201', async () => {
            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(201);
            expect(res.body.msg).toBe('收藏成功');

            // 验证数据库
            const fav = await Favorite.findOne({ userId, hotelId });
            expect(fav).toBeTruthy();
        });

        it('1.2 重复收藏：再次收藏同一酒店应返回 400', async () => {
            // 先收藏一次
            await Favorite.create({ userId, hotelId });

            // 再请求一次
            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('您已收藏过该酒店');
        });

        it('1.3 参数错误：无效的 ObjectId 格式应返回 400', async () => {
            const res = await request(app)
                .post('/api/favorites/123-invalid-id') // 无效ID
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('无效的酒店ID格式');
        });

        it('1.4 资源不存在：ID格式正确但酒店不存在应返回 404', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/favorites/${fakeId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.msg).toBe('酒店不存在');
        });

        it('1.5 服务器错误：模拟数据库异常返回 500', async () => {
            const spy = jest.spyOn(Favorite, 'findOne').mockImplementationOnce(() => {
                throw new Error('DB Error');
            });

            const res = await request(app)
                .post(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });

    // ==========================================
    // 2. 测试检查收藏状态 (GET /api/favorites/check/:hotelId)
    // ==========================================
    describe('GET /api/favorites/check/:hotelId', () => {

        beforeEach(async () => await Favorite.deleteMany({}));

        it('2.1 未收藏状态：应返回 isFavorite: false', async () => {
            const res = await request(app)
                .get(`/api/favorites/check/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.isFavorite).toBe(false);
        });

        it('2.2 已收藏状态：应返回 isFavorite: true', async () => {
            await Favorite.create({ userId, hotelId });

            const res = await request(app)
                .get(`/api/favorites/check/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.isFavorite).toBe(true);
        });

        it('2.3 服务器错误：模拟异常返回 500', async () => {
            const spy = jest.spyOn(Favorite, 'findOne').mockImplementationOnce(() => {
                throw new Error('DB Error');
            });
            const res = await request(app)
                .get(`/api/favorites/check/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });

    // ==========================================
    // 3. 测试获取收藏列表 (GET /api/favorites)
    // ==========================================
    describe('GET /api/favorites', () => {

        beforeEach(async () => await Favorite.deleteMany({}));

        it('3.1 成功获取：应返回包含酒店详情的列表', async () => {
            await Favorite.create({ userId, hotelId });

            const res = await request(app)
                .get('/api/favorites')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBe(1);
            // 验证 populate 是否生效
            expect(res.body[0].hotelId).toHaveProperty('name', '收藏测试酒店');
        });

        it('3.2 脏数据过滤：若酒店已删除，列表应自动过滤', async () => {
            // 1. 创建一个临时酒店和收藏
            const tempHotel = await Hotel.create({
                name: '即将倒闭的酒店',
                city: 'Test',
                address: 'Test',
                starRating: 1,
                price: 10,
                location: { type: 'Point', coordinates: [0,0] },
                merchantId: new mongoose.Types.ObjectId()
            });
            await Favorite.create({ userId, hotelId: tempHotel._id });

            // 2. 还有之前的正常酒店收藏
            await Favorite.create({ userId, hotelId });

            // 3. 删除临时酒店 (物理删除)
            await Hotel.findByIdAndDelete(tempHotel._id);

            // 4. 获取列表
            const res = await request(app)
                .get('/api/favorites')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            // 应该只剩下一个有效的收藏（正常酒店的），已删除酒店的收藏被 filter 掉了
            expect(res.body.length).toBe(1);
            expect(res.body[0].hotelId.name).toBe('收藏测试酒店');
        });

        it('3.3 服务器错误：模拟异常返回 500', async () => {
            const spy = jest.spyOn(Favorite, 'find').mockImplementationOnce(() => {
                throw new Error('Populate Error');
            });
            const res = await request(app)
                .get('/api/favorites')
                .set('Authorization', `Bearer ${token}`);
            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });

    // ==========================================
    // 4. 测试取消收藏 (DELETE /api/favorites/:hotelId)
    // ==========================================
    describe('DELETE /api/favorites/:hotelId', () => {

        beforeEach(async () => {
            await Favorite.deleteMany({});
            await Favorite.create({ userId, hotelId }); // 预置收藏
        });

        it('4.1 取消成功：应返回 200', async () => {
            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.msg).toBe('已取消收藏');

            const check = await Favorite.findOne({ userId, hotelId });
            expect(check).toBeNull();
        });

        it('4.2 资源不存在：取消未收藏的记录应返回 404', async () => {
            // 先删掉
            await Favorite.deleteMany({});

            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.msg).toBe('未找到收藏记录');
        });

        it('4.3 服务器错误：模拟异常返回 500', async () => {
            const spy = jest.spyOn(Favorite, 'findOneAndDelete').mockImplementationOnce(() => {
                throw new Error('Delete Error');
            });
            const res = await request(app)
                .delete(`/api/favorites/${hotelId}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });

});