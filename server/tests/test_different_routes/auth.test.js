const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../../app');
const User = require('../../models/User');

// 设置较长的超时时间，防止数据库连接慢导致测试失败
jest.setTimeout(30000);

describe('认证模块路由测试 (Auth Routes)', () => {

    // === 环境准备 ===
    beforeAll(async () => {
        // 确保连接到测试数据库
        const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/yisu_test_auth_routes';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }
    });

    // 每个测试用例执行前清空用户表，保证环境纯净
    beforeEach(async () => {
        await User.deleteMany({});
    });

    // 所有测试结束后断开连接
    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. 测试注册接口 (POST /api/auth/register)
    // ==========================================
    describe('POST /api/auth/register', () => {

        it('1.1 成功注册：输入有效信息应返回 201', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    role: 'user'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.msg).toBe('注册成功！请登录');

            // 验证数据库中是否真的存入了数据，且密码已加密
            const user = await User.findOne({ username: 'testuser' });
            expect(user).toBeTruthy();
            expect(user.role).toBe('user');
            expect(user.password).not.toBe('password123'); // 必须是 Hash 过的
        });

        it('1.2 参数缺失：缺少 username 应返回 400', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    password: 'password123'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('账号和密码不能为空');
        });

        it('1.3 参数缺失：缺少 password 应返回 400', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('账号和密码不能为空');
        });

        it('1.4 重复注册：账号已存在应返回 400', async () => {
            // 先在数据库创建一个用户
            await User.create({
                username: 'existing_user',
                password: 'somepassword'
            });

            // 再次尝试注册同名用户
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'existing_user',
                    password: 'newpassword'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('该账号已被注册');
        });

        it('1.5 服务器错误：模拟数据库异常返回 500', async () => {
            // Mock User.findOne 抛出错误
            const spy = jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
                throw new Error('Database connection failed');
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'err_user', password: '123' });

            expect(res.statusCode).toBe(500);
            expect(res.body.msg).toBe('服务器错误');

            // 恢复 Mock
            spy.mockRestore();
        });
    });

    // ==========================================
    // 2. 测试登录接口 (POST /api/auth/login)
    // ==========================================
    describe('POST /api/auth/login', () => {

        // 预先创建一个用户用于登录测试
        const mockUser = {
            username: 'login_user',
            password: 'login_pass_123',
            role: 'merchant'
        };

        beforeEach(async () => {
            // 手动加密密码并存入数据库
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(mockUser.password, salt);
            await User.create({
                username: mockUser.username,
                password: hashedPassword,
                role: mockUser.role
            });
        });

        it('2.1 成功登录：返回 Token 和用户信息', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: mockUser.username,
                    password: mockUser.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.msg).toBe('登录成功');
            expect(res.body.token).toBeDefined(); // Token 必须存在
            // 验证返回的用户信息
            expect(res.body.user).toMatchObject({
                username: mockUser.username,
                role: mockUser.role
            });
            expect(res.body.user).toHaveProperty('id');
        });

        it('2.2 账号不存在：输入错误的用户名返回 400', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'wrong_user',
                    password: mockUser.password
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('账号不存在');
        });

        it('2.3 密码错误：输入错误的密码返回 400', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: mockUser.username,
                    password: 'wrong_password'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('密码错误');
        });

        it('2.4 服务器错误：模拟数据库异常返回 500', async () => {
            // Mock User.findOne 抛出错误
            const spy = jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
                throw new Error('Database Error');
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'any', password: 'any' });

            expect(res.statusCode).toBe(500);
            expect(res.body.msg).toBe('服务器错误');

            spy.mockRestore();
        });
    });

});