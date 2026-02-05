// 登录认证路由
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// 从配置文件中拿取密钥
const JWT_SECRET = process.env.JWT_SECRET;

// 注册接口 (POST /api/auth/register)
router.post('/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // 检查必填项
        if (!username || !password) {
            return res.status(400).json({ msg: '账号和密码不能为空' });
        }

        // 检查账号是否已存在
        const existingUser = await User.findOne({ username: username.toString() });
        if (existingUser) {
            return res.status(400).json({ msg: '该账号已被注册' });
        }

        // 密码加密 (Hash)
        // 自动生成盐值并加密，10 是盐的复杂度
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 创建新用户
        const newUser = new User({
            username,
            password: hashedPassword, // 存入加密后的密码
            role: role || 'user'      // 默认为普通用户
        });

        await newUser.save();
        res.status(201).json({ msg: '注册成功！请登录' });

    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 登录接口 (POST /api/auth/login)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 找用户
        const user = await User.findOne({ username: username.toString() });
        if (!user) {
            return res.status(400).json({ msg: '账号不存在' });
        }

        // 验证密码 (将输入的明文密码与数据库的 Hash 密码对比)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: '密码错误' });
        }

        // 签发 JWT Token
        // payload 是 Token 里藏的数据，前端解码后能看到
        const payload = {
            userId: user._id,
            role: user.role,
            username: user.username
        };

        // 签发 Token，有效期 24 小时
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        // 返回结果
        res.json({
            msg: '登录成功',
            token: token, // 前端拿到这个 Token 存起来
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

module.exports = router;