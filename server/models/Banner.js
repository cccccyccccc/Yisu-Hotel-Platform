const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    // 图片地址 (上传后返回的相对路径)
    imageUrl: {
        type: String,
        required: true
    },
    // 点击后跳转的酒店ID
    targetHotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    // 标题 (可选，用于后台展示或 SEO)
    title: {
        type: String
    },
    // 排序权重 (数字越大越靠前，用于运营调整顺序)
    priority: {
        type: Number,
        default: 0
    },
    // 状态 (1: 上线, 0: 下线)
    status: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Banner', bannerSchema);