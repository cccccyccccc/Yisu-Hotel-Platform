// tests/test_different_routes/rooms.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require("../../app");
const User = require('../../models/User');
const Hotel = require('../../models/Hotel');
const RoomType = require('../../models/RoomType');

// 设置较长超时
jest.setTimeout(30000);

describe('房型模块路由测试 (Room Routes)', () => {

    let merchantToken, userToken;
    let merchantId;
    let hotelId;
    let roomId;

    // === 环境准备 ===
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_rooms';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        // 1. 清理
        await User.deleteMany({});
        await Hotel.deleteMany({});
        await RoomType.deleteMany({});

        // 2. 注册账号
        // Merchant A (Owner)
        await request(app).post('/api/auth/register').send({ username: 'room_mer', password: '123', role: 'merchant' });
        const loginMer = await request(app).post('/api/auth/login').send({ username: 'room_mer', password: '123' });
        merchantToken = loginMer.body.token;
        merchantId = loginMer.body.user._id;

        // Merchant B (Other)
        await request(app).post('/api/auth/register').send({ username: 'other_mer', password: '123', role: 'merchant' });
        await request(app).post('/api/auth/login').send({ username: 'other_mer', password: '123' });
        // otherMerchantId unused

        // User (No permission)
        await request(app).post('/api/auth/register').send({ username: 'room_user', password: '123', role: 'user' });
        userToken = (await request(app).post('/api/auth/login').send({ username: 'room_user', password: '123' })).body.token;

        // 3. 创建酒店 (属于 Merchant A)
        const hotel = await Hotel.create({
            merchantId,
            name: '房型测试酒店',
            city: '测试市',
            address: '测试路',
            starRating: 5,
            price: 500,
            location: { type: 'Point', coordinates: [0, 0] },
            status: 1
        });
        hotelId = hotel._id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. 添加房型 (POST /api/rooms)
    // ==========================================
    describe('POST /api/rooms', () => {

        const newRoomData = {
            title: '豪华大床房',
            price: 800,
            stock: 10,
            capacity: 2,
            bedInfo: '2米大床',
            size: '40m²',
            images: ['room1.jpg']
        };

        it('1.1 权限拒绝：普通用户无法添加', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ ...newRoomData, hotelId });
            expect(res.statusCode).toBe(403);
            expect(res.body.msg).toBe('权限不足');
        });

        it('1.2 成功添加：商户为自己的酒店添加房型', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ ...newRoomData, hotelId });

            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe(newRoomData.title);
            expect(res.body.price).toBe(800);
            roomId = res.body._id; // 保存供后续测试
        });

        it('1.3 权限拒绝：为他人的酒店添加房型', async () => {
            // 登录另一个商户
            const tokenB = (await request(app).post('/api/auth/login').send({ username: 'other_mer', password: '123' })).body.token;

            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ ...newRoomData, hotelId }); // hotelId 属于 Merchant A

            expect(res.statusCode).toBe(403);
            expect(res.body.msg).toBe('无权操作此酒店');
        });

        it('1.4 参数校验：缺少必填项', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ hotelId }); // 缺 title, price, stock
            expect(res.statusCode).toBe(400);
        });

        it('1.5 参数校验：无效的 hotelId', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ ...newRoomData, hotelId: 'invalid' });
            expect(res.statusCode).toBe(400);
        });

        it('1.6 资源不存在：酒店ID格式正确但不存在', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ ...newRoomData, hotelId: fakeId });
            expect(res.statusCode).toBe(404);
        });
    });

    // ==========================================
    // 2. 获取房型列表 (GET /api/rooms/:hotelId)
    // ==========================================
    describe('GET /api/rooms/:hotelId', () => {
        it('2.1 成功获取：返回该酒店的房型列表', async () => {
            const res = await request(app).get(`/api/rooms/${hotelId}`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0].title).toBe('豪华大床房');
        });

        it('2.2 参数错误：无效的 hotelId', async () => {
            const res = await request(app).get('/api/rooms/invalid-id');
            expect(res.statusCode).toBe(400);
        });
    });

    // ==========================================
    // 3. 修改房型 (PUT /api/rooms/:id)
    // ==========================================
    describe('PUT /api/rooms/:id', () => {

        const updateData = {
            title: '升级版豪华房',
            price: 999,
            stock: 5,
            capacity: 3,
            bedInfo: '2.2米大床',
            size: '50m²',
            images: ['new.jpg'],
            originalPrice: 1200
        };

        it('3.1 成功修改：全字段覆盖更新', async () => {
            const res = await request(app)
                .put(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe(updateData.title);
            expect(res.body.price).toBe(999);
            expect(res.body.stock).toBe(5);
            expect(res.body.bedInfo).toBe('2.2米大床');
            // 验证数据库
            const dbRoom = await RoomType.findById(roomId);
            expect(dbRoom.title).toBe('升级版豪华房');
        });

        it('3.2 权限拒绝：普通用户', async () => {
            const res = await request(app)
                .put(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updateData);
            expect(res.statusCode).toBe(403);
        });

        it('3.3 权限拒绝：非本人酒店', async () => {
            const tokenB = (await request(app).post('/api/auth/login').send({ username: 'other_mer', password: '123' })).body.token;
            const res = await request(app)
                .put(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send(updateData);
            expect(res.statusCode).toBe(403);
        });

        it('3.4 资源不存在：房型ID不存在', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/rooms/${fakeId}`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(updateData);
            expect(res.statusCode).toBe(404);
        });
    });

    // ==========================================
    // 4. 价格日历 (PUT & GET Calendar)
    // ==========================================
    describe('价格日历操作', () => {

        const calendarData = [
            { date: '2026-10-01', price: 1000, stock: 5 }, // 新增
            { date: '2026-10-02', price: 1200 }            // 新增
        ];

        it('4.1 设置日历：成功更新', async () => {
            const res = await request(app)
                .put(`/api/rooms/${roomId}/calendar`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ calendarData });

            expect(res.statusCode).toBe(200);
            expect(res.body.priceCalendar.length).toBe(2);
            expect(res.body.priceCalendar[0].date).toBe('2026-10-01');
        });

        it('4.2 更新日历：覆盖旧数据', async () => {
            const newData = [
                { date: '2026-10-01', price: 2000 }, // 更新价格
                { date: '2026-10-03', price: 1500 }  // 新增日期
            ];

            const res = await request(app)
                .put(`/api/rooms/${roomId}/calendar`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ calendarData: newData });

            expect(res.statusCode).toBe(200);
            // 应该是 3 条记录 (1号更新，2号保留，3号新增)
            // 注意：顺序可能不固定，取决于实现，但逻辑上是 3 条
            const updatedRoom = await RoomType.findById(roomId);
            expect(updatedRoom.priceCalendar.length).toBe(3);

            const day1 = updatedRoom.priceCalendar.find(c => c.date === '2026-10-01');
            expect(day1.price).toBe(2000);
        });

        it('4.3 格式错误：calendarData 不是数组', async () => {
            const res = await request(app)
                .put(`/api/rooms/${roomId}/calendar`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ calendarData: 'invalid' });
            expect(res.statusCode).toBe(400);
        });

        it('4.4 获取日历：包含基础价和特殊价', async () => {
            const res = await request(app).get(`/api/rooms/${roomId}/calendar`);
            expect(res.statusCode).toBe(200);
            expect(res.body.basePrice).toBeDefined();
            expect(res.body.calendar.length).toBeGreaterThan(0);
        });
    });

    // ==========================================
    // 5. 删除房型 (DELETE /api/rooms/:id)
    // ==========================================
    describe('DELETE /api/rooms/:id', () => {
        it('5.1 权限拒绝：他人删除', async () => {
            const tokenB = (await request(app).post('/api/auth/login').send({ username: 'other_mer', password: '123' })).body.token;
            const res = await request(app)
                .delete(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${tokenB}`);
            expect(res.statusCode).toBe(403);
        });

        it('5.2 删除成功', async () => {
            const res = await request(app)
                .delete(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${merchantToken}`);
            expect(res.statusCode).toBe(200);

            const check = await RoomType.findById(roomId);
            expect(check).toBeNull();
        });

        it('5.3 资源不存在：再次删除返回 404', async () => {
            const res = await request(app)
                .delete(`/api/rooms/${roomId}`)
                .set('Authorization', `Bearer ${merchantToken}`);
            expect(res.statusCode).toBe(404);
        });
    });

    // ==========================================
    // 6. 补充异常分支 (Coverage)
    // ==========================================
    describe('异常分支覆盖', () => {
        it('6.1 服务器错误覆盖 (GET)', async () => {
            const spy = jest.spyOn(RoomType, 'find').mockImplementationOnce(() => {
                throw new Error('DB Error');
            });
            const res = await request(app).get(`/api/rooms/${hotelId}`);
            expect(res.statusCode).toBe(500);
            spy.mockRestore();
        });
    });

});