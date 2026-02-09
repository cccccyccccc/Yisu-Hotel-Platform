// 聊天消息模型
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // 会话ID（由两个用户ID排序拼接生成，确保唯一）
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  // 发送者
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 接收者
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 消息内容
  content: {
    type: String,
    required: true,
    trim: true
  },
  // 消息类型
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  // 是否已读
  read: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now }
});

// 复合索引：加速会话消息查询
messageSchema.index({ conversationId: 1, createdAt: -1 });

// 生成会话ID的静态方法
messageSchema.statics.generateConversationId = function (userId1, userId2) {
  return [userId1, userId2].sort((a, b) => String(a).localeCompare(String(b))).join('_');
};

module.exports = mongoose.model('Message', messageSchema);
