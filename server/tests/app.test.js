const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // 回到 server 根目录找 app.js

describe('App 核心入口测试 (App.js)', () => {

    // 确保测试能连上数据库（app.js 里虽然有连接逻辑，但为了稳健，测试文件通常自己管理连接）
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_app';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // 1. 测试根路由 (覆盖 app.get('/'))
    it('GET / 应该返回欢迎信息', async () => {
        const res = await request(app).get('/');

        expect(res.statusCode).toBe(200);
        // 根据你在 app.js 里的写法，这里应该是 text/html 或 text/plain
        // 你的 app.js 写的是: res.send('易宿酒店平台后端服务已启动！');
        expect(res.text).toContain('易宿酒店平台后端服务已启动');
    });

    // 2. 测试 404 (虽然 app.js 可能没显式写 404 处理，但 Express 默认会有，测一下无妨)
    it('GET /unknown-route 应该返回 404', async () => {
        const res = await request(app).get('/api/this-route-does-not-exist');
        expect(res.statusCode).toBe(404);
    });

});