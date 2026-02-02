// 订单信息表
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // 下单用户
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 预订的酒店
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    // 预订的房型
    roomTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RoomType',
        required: true
    },

    checkInDate: { type: Date, required: true },  // 入住日期
    checkOutDate: { type: Date, required: true }, // 离店日期
    quantity: { type: Number, default: 1 },       // 房间数
    totalPrice: { type: Number, required: true }, // 总价

    // 订单状态
    status: {
        type: String,
        enum: ['pending', 'paid', 'completed', 'cancelled'],
        default: 'pending'
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);