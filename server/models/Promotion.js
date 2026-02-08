// 促销活动模型
const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  // 所属酒店
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  // 促销标题
  title: {
    type: String,
    required: [true, '促销标题不能为空'],
    trim: true,
    maxlength: [50, '标题不能超过50个字符']
  },
  // 促销描述
  description: {
    type: String,
    maxlength: [200, '描述不能超过200个字符']
  },
  // 促销类型
  type: {
    type: String,
    enum: ['discount', 'amount_off', 'fixed_price'],
    required: true
    // discount: 折扣 (如0.8表示8折)
    // amount_off: 满减 (如满500减50)
    // fixed_price: 特价 (固定价格)
  },
  // 折扣值
  discountValue: {
    type: Number,
    required: true
    // discount类型: 0.1-0.99 (1折-9.9折)
    // amount_off类型: 减免金额
    // fixed_price类型: 固定价格
  },
  // 满减门槛 (仅amount_off类型使用)
  minAmount: {
    type: Number,
    default: 0
  },
  // 适用房型 (空数组表示适用所有房型)
  roomTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  }],
  // 开始日期
  startDate: {
    type: Date,
    required: true
  },
  // 结束日期
  endDate: {
    type: Date,
    required: true
  },
  // 状态: 0下线 1上线
  status: {
    type: Number,
    enum: [0, 1],
    default: 1
  },
  createdAt: { type: Date, default: Date.now }
});

// 索引
promotionSchema.index({ hotelId: 1, status: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });

// 静态方法：获取房型当前有效促销
promotionSchema.statics.getActivePromotions = async function (hotelId, roomTypeId, date = new Date()) {
  return this.find({
    hotelId,
    status: 1,
    startDate: { $lte: date },
    endDate: { $gte: date },
    $or: [
      { roomTypes: { $size: 0 } },
      { roomTypes: roomTypeId }
    ]
  }).sort({ type: 1 }); // 优先返回折扣类型
};

// 计算促销价格
promotionSchema.statics.calculatePrice = function (originalPrice, promotion) {
  if (!promotion) return originalPrice;

  switch (promotion.type) {
    case 'discount':
      return Math.round(originalPrice * promotion.discountValue);
    case 'amount_off':
      if (originalPrice >= promotion.minAmount) {
        return Math.max(0, originalPrice - promotion.discountValue);
      }
      return originalPrice;
    case 'fixed_price':
      return promotion.discountValue;
    default:
      return originalPrice;
  }
};

module.exports = mongoose.model('Promotion', promotionSchema);
