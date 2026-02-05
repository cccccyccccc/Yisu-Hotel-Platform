// 酒店信息表
const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
    // 关联发布该酒店的商户
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 必须维度
    name: { type: String, required: true }, // 中文名
    nameEn: { type: String },               // 英文名
    city: { type: String, required: true }, // 城市
    address: { type: String, required: true },

    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // 格式：[经度, 纬度]
            required: true
        }
    },

    starRating: { type: Number, required: true, min: 1, max: 5 },
    price: { type: Number, required: true }, // 起始价格
    openingTime: { type: String },           // 开业时间

    score: {
        type: Number,
        default: 5 // 默认评分
    },

    // 详细信息 & 媒体
    description: { type: String },
    tags: [String],                // 标签，如 ["免费停车", "亲子"]
    images: [String],              // 图片路径数组

    // 可选维度：酒店附近信息
    nearbyAttractions: [String],   // 热门景点，如 ["故宫", "天安门广场"]
    nearbyTransport: [String],     // 交通信息，如 ["地铁1号线王府井站步行5分钟", "首都机场30公里"]
    nearbyMalls: [String],         // 商场信息，如 ["王府井百货", "东方新天地"]

    // 审核状态
    // 0: 待审核, 1: 已发布(通过), 2: 审核不通过, 3: 已下线
    status: {
        type: Number,
        enum: [0, 1, 2, 3],
        default: 0
    },
    // 如果 status 为 2 (不通过)，此字段必填
    rejectReason: {
        type: String,
        default: ''
    },
    createdAt: { type: Date, default: Date.now }
});

hotelSchema.index({ location: '2dsphere' });

// 索引优化：加速城市筛选搜索
hotelSchema.index({ city: 1, status: 1 });

// 索引优化：加速价格排序搜索
hotelSchema.index({ status: 1, price: 1 });

// 索引优化：加速商户酒店列表查询
hotelSchema.index({ merchantId: 1, createdAt: -1 });

module.exports = mongoose.model('Hotel', hotelSchema);