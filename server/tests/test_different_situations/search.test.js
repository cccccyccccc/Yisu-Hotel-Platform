// 酒店筛选测试

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const Hotel = require('../../models/Hotel');
const RoomType = require('../../models/RoomType');
const User = require('../../models/User'); // 假如你需要创建用户来做距离计算

describe('高级搜索与筛选逻辑测试 (Search & Filtering)', () => {

    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu-test-search';
        await mongoose.connect(TEST_URI);

        // 清空数据
        await Hotel.deleteMany({});
        await RoomType.deleteMany({});

        // === 准备测试数据 (3家酒店) ===
        // 酒店 A: 上海, 5星, 1000元, 标签: [亲子, 泳池], 位置: 人民广场 (0,0)
        const hotelA = await Hotel.create({
            merchantId: new mongoose.Types.ObjectId(),
            name: '上海核心大酒店',
            city: '上海',
            address: '市中心',
            starRating: 5,
            price: 1000,
            tags: ['亲子', '泳池'],
            location: { type: 'Point', coordinates: [121.47, 31.23] }, // 假设这是中心
            score: 4.8,
            status: 1
        });

        // 酒店 B: 上海, 3星, 300元, 标签: [亲子], 位置: 郊区 (远)
        const hotelB = await Hotel.create({
            merchantId: new mongoose.Types.ObjectId(),
            name: '上海郊区亲子民宿',
            city: '上海',
            address: '郊区',
            starRating: 3,
            price: 300,
            tags: ['亲子'], // 只有亲子，没有泳池
            location: { type: 'Point', coordinates: [121.80, 31.50] }, // 较远
            score: 4.5,
            status: 1
        });

        // 酒店 C: 北京, 5星, 2000元, 标签: [泳池]
        const hotelC = await Hotel.create({
            merchantId: new mongoose.Types.ObjectId(),
            name: '北京奢华酒店',
            city: '北京',
            address: '王府井',
            starRating: 5,
            price: 2000,
            tags: ['泳池'],
            location: { type: 'Point', coordinates: [116.40, 39.90] },
            score: 4.9,
            status: 1
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    it('1. [基础筛选] 按城市筛选 (应只返回上海的2家)', async () => {
        const res = await request(app).get('/api/hotels').query({ city: '上海' });
        expect(res.body.data.length).toBe(2);
        const names = res.body.data.map(h => h.name);
        expect(names).toContain('上海核心大酒店');
        expect(names).toContain('上海郊区亲子民宿');
    });

    it('2. [多条件] 城市 + 星级 (上海 + 5星 -> 只有酒店A)', async () => {
        const res = await request(app).get('/api/hotels').query({
            city: '上海',
            starRating: 5
        });
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe('上海核心大酒店');
    });

    it('3. [价格区间] 筛选 200-500元 (只有酒店B)', async () => {
        const res = await request(app).get('/api/hotels').query({
            minPrice: 200,
            maxPrice: 500
        });
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe('上海郊区亲子民宿');
    });

    it('4. [Tags筛选] 单标签筛选 (亲子 -> A和B)', async () => {
        const res = await request(app).get('/api/hotels').query({ tags: '亲子' });
        expect(res.body.data.length).toBe(2);
    });

    it('5. [Tags筛选] 组合标签 (亲子 + 泳池 -> 只有A)', async () => {
        // 只有酒店A同时拥有这两个标签
        const res = await request(app).get('/api/hotels').query({ tags: '亲子,泳池' });
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe('上海核心大酒店');
    });

    it('6. [排序] 价格升序 (B -> A -> C)', async () => {
        const res = await request(app).get('/api/hotels').query({ sortType: 'price_asc' });
        const prices = res.body.data.map(h => h.price);
        // 预期: 300, 1000, 2000
        expect(prices).toEqual([300, 1000, 2000]);
    });

    it('7. [排序] 评分降序 (C -> A -> B)', async () => {
        const res = await request(app).get('/api/hotels').query({ sortType: 'score_desc' });
        const scores = res.body.data.map(h => h.score);
        // 预期: 4.9, 4.8, 4.5
        expect(scores).toEqual([4.9, 4.8, 4.5]);
    });

    it('8. [LBS排序] 距离排序 (用户在上海中心 -> A应该排在B前面)', async () => {
        const res = await request(app).get('/api/hotels').query({
            city: '上海',
            sortType: 'distance',
            userLng: 121.47, // 用户就在酒店A旁边
            userLat: 31.23
        });

        expect(res.body.data.length).toBe(2);
        expect(res.body.data[0].name).toBe('上海核心大酒店'); // 距离近
        expect(res.body.data[1].name).toBe('上海郊区亲子民宿'); // 距离远
    });
});