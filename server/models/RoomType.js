// 酒店房间信息表
const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema({
    // 归属于哪个酒店
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    title: { type: String, required: true }, // 如 "经典双床房"
    price: { type: Number, required: true }, // 实际价格
    originalPrice: { type: Number },         // 原价 (可选，用于展示优惠)

    capacity: { type: Number, default: 2 },  // 可住人数
    bedInfo: { type: String },               // 如 "2张1.2米单人床"
    size: { type: String },                  // 如 "40m²"
    stock: {
        type: Number,
        required: true
    },
    images: [String],                        // 房型图片

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoomType', roomTypeSchema);