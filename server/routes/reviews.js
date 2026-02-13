const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
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

// 商户：获取我的酒店的所有评价 (GET /api/reviews/merchant/all)
router.get('/merchant/all', authMiddleware, asyncHandler(async (req, res) => {
    if (req.user.role !== 'merchant') {
        return res.status(403).json({ msg: '权限不足' });
    }

    // 先获取商户的所有酒店
    const hotels = await Hotel.find({ merchantId: req.user.userId }).select('_id name');
    const hotelIds = hotels.map(h => h._id);

    // 获取这些酒店的所有评价
    const reviews = await Review.find({ hotelId: { $in: hotelIds } })
        .populate('userId', 'username avatar')
        .populate('hotelId', 'name city')
        .sort({ createdAt: -1 });

    res.json(reviews);
}));

// 商户：回复评价 (PUT /api/reviews/:id/reply)
router.put('/:id/reply', authMiddleware, asyncHandler(async (req, res) => {
    if (req.user.role !== 'merchant') {
        return res.status(403).json({ msg: '权限不足' });
    }

    const { reply } = req.body;
    if (!reply || !reply.trim()) {
        return res.status(400).json({ msg: '回复内容不能为空' });
    }

    const review = await Review.findById(req.params.id).populate('hotelId');
    if (!review) {
        return res.status(404).json({ msg: '评价不存在' });
    }

    // 验证该评价属于商户的酒店
    const hotel = await Hotel.findById(review.hotelId?._id || review.hotelId);
    if (!hotel || hotel.merchantId.toString() !== req.user.userId) {
        return res.status(403).json({ msg: '无权回复此评价' });
    }

    review.reply = reply.trim();
    review.replyAt = new Date();
    await review.save();

    res.json({ msg: '回复成功', review });
}));

module.exports = router;