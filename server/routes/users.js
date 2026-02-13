const express = require('express');
const router = express.Router();
const User = require('../models/User');

const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { userValidators } = require('../middleware/validators');

// 获取个人详细信息 (GET /api/users/profile)
// 登录后，进入“我的”页面时调用，保证看到的是最新数据
// 获取个人详细信息 (GET /api/users/profile)
// 登录后，进入“我的”页面时调用，保证看到的是最新数据
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
    // .select('-password') 表示查出来的数据不包含密码字段，安全！
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }
    res.json(user);
}));

// 修改个人资料 (PUT /api/users/profile)
// 修改个人资料 (PUT /api/users/profile)
router.put('/profile', authMiddleware, userValidators.updateProfile, asyncHandler(async (req, res) => {
    const { avatar, gender, bio, username } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    // 允许修改用户名（需查重）、头像、性别、简介，防止用户篡改 role
    if (username !== undefined && username !== user.username) {
        const existing = await User.findOne({ username });
        if (existing) {
            throw new AppError('用户名已被占用', 400, 'USERNAME_TAKEN');
        }
        user.username = username;
    }
    if (avatar !== undefined) user.avatar = avatar;
    if (gender !== undefined) user.gender = gender;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    // 返回更新后的对象（转成普通对象并剔除密码）
    const userObj = user.toObject();
    delete userObj.password;

    res.json(userObj);
}));

// 获取所有用户列表 (管理员) GET /api/users/admin/list
router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }

    const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 });

    res.json(users);
}));

// 修改密码 PUT /api/users/password
router.put('/password', authMiddleware, asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        throw new AppError('请提供旧密码和新密码', 400, 'VALIDATION_ERROR');
    }

    if (newPassword.length < 6) {
        throw new AppError('新密码长度不能少于6位', 400, 'VALIDATION_ERROR');
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    // 验证旧密码
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        throw new AppError('旧密码不正确', 400, 'INVALID_PASSWORD');
    }

    // 更新密码
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: '密码修改成功' });
}));

module.exports = router;