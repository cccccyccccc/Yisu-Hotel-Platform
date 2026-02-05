const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { reviewValidators } = require('../middleware/validators');

// 发表评价 (POST /api/reviews)
router.post('/', authMiddleware, reviewValidators.create, asyncHandler(async (req, res) => {
    const { hotelId, rating, content } = req.body;

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
        { $match: { hotelId: newReview.hotelId } },
        { $group: { _id: '$hotelId', avgRating: { $avg: '$rating' } } }
    ]);

    if (stats.length > 0) {
        const score = Math.round(stats[0].avgRating * 10) / 10;
        await Hotel.findByIdAndUpdate(hotelId, { score: score });
    }

    res.status(201).json({ msg: '评价发布成功' });
}));

// 获取某酒店的评价列表 (GET /api/reviews/:hotelId)
router.get('/:hotelId', asyncHandler(async (req, res) => {
    const reviews = await Review.find({ hotelId: String(req.params.hotelId) })
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 });
    res.json(reviews);
}));

module.exports = router;