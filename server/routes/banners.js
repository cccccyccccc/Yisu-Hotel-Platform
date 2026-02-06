const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');

const cache = require('../middleware/cache');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { bannerValidators } = require('../middleware/validators');

// 获取所有轮播图列表 (管理员) GET /api/banners/admin/list
router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
    // 权限检查
    if (req.user.role !== 'admin') {
        throw new AppError('只有管理员可以查看轮播图列表', 403, 'FORBIDDEN');
    }

    // 获取所有轮播图（包括下线的）
    const banners = await Banner.find()
        .sort({ priority: -1, createdAt: -1 })
        .populate('targetHotelId', 'name starRating');

    // 转换字段名以匹配前端期望的格式
    const formattedBanners = banners.map(banner => ({
        _id: banner._id,
        title: banner.title || '',
        imageUrl: banner.imageUrl,
        link: banner.targetHotelId ? `/hotels/${banner.targetHotelId._id}` : '',
        sort: banner.priority || 0,
        isActive: banner.status === 1,
        createdAt: banner.createdAt
    }));

    res.json(formattedBanners);
}));

// 获取首页轮播图 (公开接口) GET /api/banners
router.get('/', cache(300), asyncHandler(async (req, res) => {
    // 只查询状态为 1 (上线) 的轮播图
    const banners = await Banner.find({ status: 1 })
        .sort({ priority: -1, createdAt: -1 })
        .populate('targetHotelId', 'name starRating');

    res.json(banners);
}));

// 发布轮播图 (仅管理员) POST /api/banners
router.post('/', authMiddleware, bannerValidators.create, asyncHandler(async (req, res) => {
    // 权限检查
    if (req.user.role !== 'admin') {
        throw new AppError('只有管理员可以管理轮播图', 403, 'FORBIDDEN');
    }

    const { imageUrl, targetHotelId, title, priority, isActive } = req.body;

    const newBanner = new Banner({
        imageUrl,
        targetHotelId,
        title,
        priority: priority || 0,
        status: isActive !== false ? 1 : 0
    });

    await newBanner.save();
    res.status(201).json({
        _id: newBanner._id,
        title: newBanner.title,
        imageUrl: newBanner.imageUrl,
        sort: newBanner.priority,
        isActive: newBanner.status === 1
    });
}));

// 更新轮播图 (仅管理员) PUT /api/banners/:id
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }

    const { title, imageUrl, link, sort, isActive } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (sort !== undefined) updateData.priority = sort;
    if (isActive !== undefined) updateData.status = isActive ? 1 : 0;

    const banner = await Banner.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
    );

    if (!banner) {
        throw new AppError('轮播图不存在', 404, 'BANNER_NOT_FOUND');
    }

    res.json({
        _id: banner._id,
        title: banner.title,
        imageUrl: banner.imageUrl,
        sort: banner.priority,
        isActive: banner.status === 1
    });
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