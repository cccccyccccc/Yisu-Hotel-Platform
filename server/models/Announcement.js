const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '公告标题不能为空'],
    trim: true,
    maxlength: [100, '公告标题不能超过100个字符']
  },
  content: {
    type: String,
    required: [true, '公告内容不能为空'],
    maxlength: [5000, '公告内容不能超过5000个字符']
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning'],
    default: 'info'
  },
  status: {
    type: Number,
    enum: [0, 1], // 0: 下线, 1: 上线
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引
announcementSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
