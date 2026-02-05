const express = require('express');
const router = express.Router();
const User = require('../models/User');
const logger = require('../utils/logger');
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
    const { avatar, gender, bio } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    // 只允许修改这三个字段，防止用户篡改 role 或 username
    if (avatar !== undefined) user.avatar = avatar;
    if (gender !== undefined) user.gender = gender;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    // 返回更新后的对象（转成普通对象并剔除密码）
    const userObj = user.toObject();
    delete userObj.password;

    res.json(userObj);
}));

module.exports = router;