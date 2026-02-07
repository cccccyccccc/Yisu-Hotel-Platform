const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    // 评分 (1-5分)
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    // 评价内容
    content: {
        type: String,
        required: true,
        trim: true
    },
    // 商户回复
    reply: {
        type: String,
        trim: true,
        default: null
    },
    replyAt: {
        type: Date,
        default: null
    },
    createdAt: { type: Date, default: Date.now }
});

// 一个用户对同一个酒店只能评价一次 (防止刷分)
reviewSchema.index({ userId: 1, hotelId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);