const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // 账号 (唯一)
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // 密码 (存储 Hash 后的密文)
    password: {
        type: String,
        required: true
    },
    // 角色区分: 'user'(普通用户), 'merchant'(商户), 'admin'(管理员)
    role: {
        type: String,
        enum: ['user', 'merchant', 'admin'],
        default: 'user',
        required: true
    },
    // --- 个人资料 (提升用户体验) ---
    gender: {
        type: String,
        enum: ['male', 'female', 'unknown'],
        default: 'unknown'
    },
    // 头像: 存储相对路径, 例如 "/uploads/avatars/default.png"
    avatar: {
        type: String,
        default: ''
    },
    // 个人简介
    bio: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);