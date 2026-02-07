// 登录认证路由
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authValidators } = require('../middleware/validators');

// 从配置文件中拿取密钥
const JWT_SECRET = process.env.JWT_SECRET;

// 注册接口 (POST /api/auth/register)
router.post('/register', authValidators.register, asyncHandler(async (req, res) => {
    const { username, password, role } = req.body;

    // 检查账号是否已存在
    const existingUser = await User.findOne({ username: username.toString() });
    if (existingUser) {
        throw new AppError('该账号已被注册', 400, 'USER_EXISTS');
    }

    // 密码加密 (Hash)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建新用户
    const newUser = new User({
        username,
        password: hashedPassword,
        role: role || 'user'
    });

    await newUser.save();
    res.status(201).json({ msg: '注册成功！请登录' });
}));

// 登录接口 (POST /api/auth/login)
router.post('/login', authValidators.login, asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // 找用户
    const user = await User.findOne({ username: username.toString() });
    if (!user) {
        throw new AppError('账号不存在', 400, 'USER_NOT_FOUND');
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new AppError('密码错误', 400, 'WRONG_PASSWORD');
    }

    // 签发 JWT Token
    const payload = {
        userId: user._id,
        role: user.role,
        username: user.username
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
        msg: '登录成功',
        token: token,
        user: {
            _id: user._id,
            username: user.username,
            role: user.role,
            avatar: user.avatar
        }
    });
}));

module.exports = router;