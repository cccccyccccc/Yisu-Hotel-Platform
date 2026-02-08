// 公告已读记录模型
const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
});

// 复合唯一索引：用户+公告唯一
announcementReadSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);
