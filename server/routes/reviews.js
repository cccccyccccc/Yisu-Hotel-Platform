const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Hotel = require('../models/Hotel');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');

// 发表评价 (POST /api/reviews)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { hotelId, rating, content } = req.body;

        // 简单校验
        if (!rating || !content) return res.status(400).json({ msg: '评分和内容不能为空' });

        // 创建评价
        const newReview = new Review({
            userId: req.user.userId,
            hotelId,
            rating,
            content
        });
        await newReview.save();

        // 核心逻辑：自动重新计算酒店平均分
        const stats = await Review.aggregate([
            { $match: { hotelId: newReview.hotelId } }, // 找出该酒店所有评价
            { $group: { _id: '$hotelId', avgRating: { $avg: '$rating' } } } // 计算平均值
        ]);
        // 如果算出来了，更新到 Hotel 表
        if (stats.length > 0) {
            // 保留1位小数 (例如 4.7)
            const score = Math.round(stats[0].avgRating * 10) / 10;
            await Hotel.findByIdAndUpdate(hotelId, { score: score });
        }
        res.status(201).json({ msg: '评价发布成功' });
    } catch (err) {
        // 捕获重复评价错误
        if (err.code === 11000) {
            return res.status(400).json({ msg: '您已经评价过该酒店了' });
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 获取某酒店的评价列表 (GET /api/reviews/:hotelId)
router.get('/:hotelId', async (req, res) => {
    try {
        const reviews = await Review.find({ hotelId: String(req.params.hotelId) })
            .populate('userId', 'username avatar') // 关联显示评价人的头像和名字
            .sort({ createdAt: -1 }); // 最新评价在前面
        res.json(reviews);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

module.exports = router;