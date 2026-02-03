const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    // 谁收藏的
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 收藏了哪个酒店
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

// 作用：确保同一个用户对同一个酒店只能收藏一次，防止数据库出现重复垃圾数据
favoriteSchema.index({ userId: 1, hotelId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);