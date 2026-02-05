// tests/test_different_routes/hotels.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const RoomType = require('../../models/RoomType');
const Order = require('../../models/Order');

jest.setTimeout(30000);

describe('酒店模块路由测试 (Hotel Routes)', () => {

    let adminToken, merchantToken, userToken;
    let merchantId, userId;
    let hotelId;

    // === 环境准备 ===
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_hotels';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        // 1. 清空数据
        await User.deleteMany({});
        await Hotel.deleteMany({});
        await RoomType.deleteMany({});
        await Order.deleteMany({});

        // 2. 注册角色
        // Admin
        await request(app).post('/api/auth/register').send({ username: 'hotel_admin', password: '123', role: 'admin' });
        const loginAdmin = await request(app).post('/api/auth/login').send({ username: 'hotel_admin', password: '123' });
        adminToken = loginAdmin.body.token;

        // Merchant
        await request(app).post('/api/auth/register').send({ username: 'hotel_mer', password: '123', role: 'merchant' });
        const loginMer = await request(app).post('/api/auth/login').send({ username: 'hotel_mer', password: '123' });
        merchantToken = loginMer.body.token;
        merchantId = loginMer.body.user.id;

        // User
        await request(app).post('/api/auth/register').send({ username: 'hotel_user', password: '123', role: 'user' });
        const loginUser = await request(app).post('/api/auth/login').send({ username: 'hotel_user', password: '123' });
        userToken = loginUser.body.token;
        userId = loginUser.body.user.id;

        // 3. 确保地理位置索引存在 (用于 LBS 测试)
        await Hotel.collection.createIndex({ location: '2dsphere' });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. 发布酒店 (POST /api/hotels)
    // ==========================================
    describe('POST /api/hotels (发布)', () => {

        const newHotelData = {
            name: '上海中心酒店',
            city: '上海',
            address: '陆家嘴',
            starRating: 5,
            price: 2000,
            location: { type: 'Point', coordinates: [121.5, 31.2] } // 经度, 纬度
        };

        it('1.1 权限拒绝：普通用户无法发布', async () => {
            const res = await request(app)
                .post('/api/hotels')
                .set('Authorization', `Bearer ${userToken}`)
                .send(newHotelData);
            expect(res.statusCode).toBe(403);
        });

        it('1.2 发布成功：商户发布返回 200', async () => {
            const res = await request(app)
                .post('/api/hotels')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(newHotelData);

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe(0); // 默认待审核
            expect(res.body.merchantId).toBe(merchantId);
            hotelId = res.body._id; // 保存 ID 供后续使用
        });

        it('1.3 重名检测：同名酒店无法发布', async () => {
            const res = await request(app)
                .post('/api/hotels')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(newHotelData);
            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('该酒店名称已存在');
        });

        it('1.4 参数校验：缺少必填项', async () => {
            const res = await request(app)
                .post('/api/hotels')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ city: 'Beijing' }); // 缺 name 等

            // mongoose validation error
            expect(res.statusCode).toBe(400);
        });

        it('1.5 携带附近信息字段发布成功', async () => {
            const hotelWithNearby = {
                name: '北京附近信息测试酒店',
                city: '北京',
                address: '王府井大街',
                starRating: 5,
                price: 1500,
                location: { type: 'Point', coordinates: [116.4, 39.9] },
                nearbyAttractions: ['故宫', '天安门广场', '王府井'],
                nearbyTransport: ['地铁1号线王府井站步行5分钟', '首都机场30公里'],
                nearbyMalls: ['王府井百货', '东方新天地']
            };

            const res = await request(app)
                .post('/api/hotels')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(hotelWithNearby);

            expect(res.statusCode).toBe(200);
            expect(res.body.nearbyAttractions).toEqual(['故宫', '天安门广场', '王府井']);
            expect(res.body.nearbyTransport).toEqual(['地铁1号线王府井站步行5分钟', '首都机场30公里']);
            expect(res.body.nearbyMalls).toEqual(['王府井百货', '东方新天地']);
        });
    });

    // ==========================================
    // 2. 审核酒店 (PUT /api/hotels/:id/audit)
    // ==========================================
    describe('PUT /api/hotels/:id/audit (审核)', () => {
        it('2.1 管理员审核通过', async () => {
            const res = await request(app)
                .put(`/api/hotels/${hotelId}/audit`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 1 }); // 1=上线

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe(1);
        });
    });

    // ==========================================
    // 3. 首页搜索 (GET /api/hotels)
    // ==========================================
    describe('GET /api/hotels (搜索)', () => {

        // 准备更多数据以测试筛选
        beforeAll(async () => {
            await Hotel.create({
                merchantId: merchantId,
                name: '北京快捷酒店',
                city: '北京',
                address: '三环',
                starRating: 3,
                price: 300,
                location: { type: 'Point', coordinates: [116.4, 39.9] },
                status: 1, // 已上线
                tags: ['性价比', '地铁']
            });

            // [修复] 添加 merchantId
            // 酒店 C: 待审核 (不应被搜到)
            await Hotel.create({
                merchantId: merchantId, // <--- 关键修复
                name: '未审核酒店',
                city: '上海',           // 补充必填项，防止报错
                address: '未知路',      // 补充必填项
                starRating: 3,          // 补充必填项
                price: 100,
                location: { type: 'Point', coordinates: [0, 0] }, // 补充必填项
                status: 0
            });
        });

        it('3.1 基础搜索：应只返回已上线的酒店', async () => {
            const res = await request(app).get('/api/hotels');
            expect(res.statusCode).toBe(200);
            // 应该是 2 个 (上海中心, 北京快捷)
            const names = res.body.data.map(h => h.name);
            expect(names).toContain('上海中心酒店');
            expect(names).toContain('北京快捷酒店');
            expect(names).not.toContain('未审核酒店');
        });

        it('3.2 筛选测试：城市+价格区间', async () => {
            const res = await request(app).get('/api/hotels').query({
                city: '北京',
                minPrice: 200,
                maxPrice: 400
            });
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].name).toBe('北京快捷酒店');
        });

        it('3.3 关键词搜索 (正则)', async () => {
            const res = await request(app).get('/api/hotels').query({
                keyword: '快捷'
            });
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].name).toBe('北京快捷酒店');
        });

        it('3.4 标签筛选', async () => {
            const res = await request(app).get('/api/hotels').query({
                tags: '地铁'
            });
            expect(res.body.data.length).toBe(1);
        });

        it('3.5 LBS 距离排序', async () => {
            // 用户在上海 (121.5, 31.2)，上海酒店应该排在前面
            const res = await request(app).get('/api/hotels').query({
                sortType: 'distance',
                userLng: 121.5,
                userLat: 31.2
            });
            expect(res.body.data[0].name).toBe('上海中心酒店');
        });

        it('3.6 日期空房筛选 (核心业务逻辑)', async () => {
            // 1. 为北京酒店创建一个房型，库存 1
            const hotel = await Hotel.findOne({ name: '北京快捷酒店' });
            const room = await RoomType.create({ hotelId: hotel._id, title: '大床房', stock: 1, price: 100 });

            // 2. 创建一个订单，把 5.1-5.3 占满
            await Order.create({
                userId: userId,
                hotelId: hotel._id,
                roomTypeId: room._id,
                checkInDate: '2026-05-01',
                checkOutDate: '2026-05-03',
                quantity: 1, // 占满库存
                totalPrice: 200,
                status: 'paid'
            });

            // 3. 搜索 5.1-5.2，应该搜不到该酒店
            const resFull = await request(app).get('/api/hotels').query({
                checkInDate: '2026-05-01',
                checkOutDate: '2026-05-02'
            });
            const namesFull = resFull.body.data.map(h => h.name);
            expect(namesFull).not.toContain('北京快捷酒店');

            // 4. 搜索 5.5-5.6，应该能搜到
            const resFree = await request(app).get('/api/hotels').query({
                checkInDate: '2026-05-05',
                checkOutDate: '2026-05-06'
            });
            const namesFree = resFree.body.data.map(h => h.name);
            expect(namesFree).toContain('北京快捷酒店');
        });
    });

    // ==========================================
    // 4. 商户修改酒店 (PUT /api/hotels/:id)
    // ==========================================
    describe('PUT /api/hotels/:id', () => {
        it('4.1 修改成功：商户修改信息，状态应重置为待审核', async () => {
            // 先确认当前是上线状态
            let h = await Hotel.findById(hotelId);
            h.status = 1;
            await h.save();

            const res = await request(app)
                .put(`/api/hotels/${hotelId}`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ price: 9999 });

            expect(res.statusCode).toBe(200);
            expect(res.body.price).toBe(9999);
            expect(res.body.status).toBe(0); // 核心逻辑：修改后重置审核
        });

        it('4.2 权限拒绝：非本人商户无法修改', async () => {
            // 注册另一个商户
            await request(app).post('/api/auth/register').send({ username: 'other_mer', password: '123', role: 'merchant' });
            const tokenOther = (await request(app).post('/api/auth/login').send({ username: 'other_mer', password: '123' })).body.token;

            const res = await request(app)
                .put(`/api/hotels/${hotelId}`)
                .set('Authorization', `Bearer ${tokenOther}`)
                .send({ price: 100 });

            expect(res.statusCode).toBe(403);
        });

        it('4.3 修改附近信息字段成功', async () => {
            const res = await request(app)
                .put(`/api/hotels/${hotelId}`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({
                    nearbyAttractions: ['东方明珠', '外滩'],
                    nearbyTransport: ['地铁2号线陆家嘴站'],
                    nearbyMalls: ['正大广场', '国金中心']
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.nearbyAttractions).toEqual(['东方明珠', '外滩']);
            expect(res.body.nearbyTransport).toEqual(['地铁2号线陆家嘴站']);
            expect(res.body.nearbyMalls).toEqual(['正大广场', '国金中心']);
        });
    });

    // ==========================================
    // 5. 上下线操作 (PUT /api/hotels/:id/status)
    // ==========================================
    describe('PUT /api/hotels/:id/status', () => {
        it('5.1 商户自行下线', async () => {
            const res = await request(app)
                .put(`/api/hotels/${hotelId}/status`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ status: 3 }); // 3=下线

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe(3);
        });

        it('5.2 恢复上线', async () => {
            const res = await request(app)
                .put(`/api/hotels/${hotelId}/status`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ status: 1 });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe(1);
        });

        it('5.3 非法状态操作', async () => {
            const res = await request(app)
                .put(`/api/hotels/${hotelId}/status`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ status: 999 }); // 非法

            expect(res.statusCode).toBe(400);
        });
    });

    // ==========================================
    // 6. 其他接口覆盖 (My, Admin List, Detail)
    // ==========================================
    describe('其他接口', () => {
        it('6.1 获取详情', async () => {
            const res = await request(app).get(`/api/hotels/${hotelId}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('上海中心酒店');
        });

        it('6.2 详情 404', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/api/hotels/${fakeId}`);
            expect(res.statusCode).toBe(404);
        });

        it('6.3 详情 无效ID', async () => {
            const res = await request(app).get(`/api/hotels/invalid-id`);
            expect(res.statusCode).toBe(400); // 你代码里写的是 400
        });

        it('6.4 商户获取我的酒店', async () => {
            const res = await request(app)
                .get('/api/hotels/my')
                .set('Authorization', `Bearer ${merchantToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('6.5 管理员获取所有酒店', async () => {
            const res = await request(app)
                .get('/api/hotels/admin/list')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });
});