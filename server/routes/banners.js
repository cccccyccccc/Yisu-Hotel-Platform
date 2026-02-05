const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');

const cache = require('../middleware/cache');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { bannerValidators } = require('../middleware/validators');

// 获取首页轮播图 (公开接口) GET /api/banners
router.get('/', cache(300), asyncHandler(async (req, res) => {
    // 只查询状态为 1 (上线) 的轮播图
    const banners = await Banner.find({ status: 1 })
        .sort({ priority: -1, createdAt: -1 })
        .populate('targetHotelId', 'name starRating');

    res.json(banners);
}));

// 发布轮播图 (仅管理员) POST /api/banners
// 发布轮播图 (仅管理员) POST /api/banners
router.post('/', authMiddleware, bannerValidators.create, asyncHandler(async (req, res) => {
    // 权限检查
    if (req.user.role !== 'admin') {
        throw new AppError('只有管理员可以管理轮播图', 403, 'FORBIDDEN');
    }

    const { imageUrl, targetHotelId, title, priority } = req.body;
    // 校验已由 validator 处理

    const newBanner = new Banner({
        imageUrl,
        targetHotelId,
        title,
        priority: priority || 0
    });

    await newBanner.save();
    res.status(201).json(newBanner);
}));


// 删除轮播图 (仅管理员) DELETE /api/banners/:id
// 删除轮播图 (仅管理员) DELETE /api/banners/:id
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }

    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
        throw new AppError('轮播图不存在', 404, 'BANNER_NOT_FOUND');
    }

    res.json({ msg: '删除成功' });
}));

module.exports = router;