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

    // 价格信息
    originalPrice: { type: Number },              // 原价（优惠前）
    totalPrice: { type: Number, required: true }, // 实付总价

    // 优惠信息
    discount: {
        promotionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Promotion'
        },
        promotionTitle: String,                     // 促销标题
        discountType: String,                       // 优惠类型
        discountAmount: Number                      // 优惠金额
    },

    // 订单状态
    status: {
        type: String,
        enum: ['pending', 'paid', 'completed', 'cancelled'],
        default: 'pending'
    },

    createdAt: { type: Date, default: Date.now }
});

// 索引优化：加速用户订单查询 (我的订单列表)
orderSchema.index({ userId: 1, createdAt: -1 });

// 索引优化：加速库存检查查询 (创建订单时查重叠订单)
orderSchema.index({ roomTypeId: 1, status: 1, checkInDate: 1, checkOutDate: 1 });

module.exports = mongoose.model('Order', orderSchema);