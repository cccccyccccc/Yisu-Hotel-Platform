const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const logger = require('../utils/logger');
const cache = require('../middleware/cache');
const authMiddleware = require('../middleware/authMiddleware');

// 获取首页轮播图 (公开接口) GET /api/banners
router.get('/', cache(300), async (req, res) => {
    try {
        // 只查询状态为 1 (上线) 的轮播图
        const banners = await Banner.find({ status: 1 })
            .sort({ priority: -1, createdAt: -1 })
            .populate('targetHotelId', 'name starRating');

        res.json(banners);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 发布轮播图 (仅管理员) POST /api/banners
router.post('/', authMiddleware, async (req, res) => {
    try {
        // 权限检查
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: '只有管理员可以管理轮播图' });
        }

        const { imageUrl, targetHotelId, title, priority } = req.body;

        // 简单校验
        if (!imageUrl || !targetHotelId) {
            return res.status(400).json({ msg: '图片地址和目标酒店ID必填' });
        }

        const newBanner = new Banner({
            imageUrl,
            targetHotelId,
            title,
            priority: priority || 0
        });

        await newBanner.save();
        res.status(201).json(newBanner);

    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});


// 删除轮播图 (仅管理员) DELETE /api/banners/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: '权限不足' });
        }

        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) {
            return res.status(404).json({ msg: '轮播图不存在' });
        }

        res.json({ msg: '删除成功' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;