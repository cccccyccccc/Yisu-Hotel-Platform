const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// 获取未读公告数量 GET /api/announcements/unread/count
router.get('/unread/count', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // 获取所有上线公告ID
  const announcements = await Announcement.find({ status: 1 }).select('_id');
  const announcementIds = announcements.map(a => a._id);

  // 获取用户已读的公告ID
  const readRecords = await AnnouncementRead.find({
    userId,
    announcementId: { $in: announcementIds }
  }).select('announcementId');
  const readIds = new Set(readRecords.map(r => r.announcementId.toString()));

  // 计算未读数
  const unreadCount = announcementIds.filter(id => !readIds.has(id.toString())).length;

  res.json({ count: unreadCount });
}));

// 标记公告为已读 POST /api/announcements/:id/read
router.post('/:id/read', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const announcementId = req.params.id;

  // 检查公告是否存在
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) {
    throw new AppError('公告不存在', 404, 'NOT_FOUND');
  }

  // 创建已读记录（如果已存在则忽略）
  try {
    await AnnouncementRead.create({ userId, announcementId });
  } catch (err) {
    // 唯一索引冲突则忽略（已读过）
    if (err.code !== 11000) throw err;
  }

  res.json({ msg: '已标记为已读' });
}));

// 获取上线公告列表 (公开接口) GET /api/announcements
router.get('/', asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({ status: 1 })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('title type createdAt');

  res.json(announcements);
}));

// 获取公告详情 GET /api/announcements/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id)
    .populate('createdBy', 'username');

  if (!announcement) {
    throw new AppError('公告不存在', 404, 'NOT_FOUND');
  }

  res.json(announcement);
}));

// 获取所有公告列表 (管理员) GET /api/announcements/admin/list
router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('权限不足', 403, 'FORBIDDEN');
  }

  const announcements = await Announcement.find()
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username');

  res.json(announcements);
}));

// 创建公告 (管理员) POST /api/announcements
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('权限不足', 403, 'FORBIDDEN');
  }

  const { title, content, type, status } = req.body;

  if (!title || !content) {
    throw new AppError('标题和内容不能为空', 400, 'VALIDATION_ERROR');
  }

  const announcement = new Announcement({
    title,
    content,
    type: type || 'info',
    status: status !== undefined ? status : 1,
    createdBy: req.user.userId
  });

  await announcement.save();

  res.status(201).json({
    msg: '公告发布成功',
    data: announcement
  });
}));

// 更新公告 (管理员) PUT /api/announcements/:id
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('权限不足', 403, 'FORBIDDEN');
  }

  const { title, content, type, status } = req.body;

  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    throw new AppError('公告不存在', 404, 'NOT_FOUND');
  }

  if (title !== undefined) announcement.title = title;
  if (content !== undefined) announcement.content = content;
  if (type !== undefined) announcement.type = type;
  if (status !== undefined) announcement.status = status;

  await announcement.save();

  res.json({
    msg: '公告更新成功',
    data: announcement
  });
}));

// 删除公告 (管理员) DELETE /api/announcements/:id
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('权限不足', 403, 'FORBIDDEN');
  }

  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) {
    throw new AppError('公告不存在', 404, 'NOT_FOUND');
  }

  res.json({ msg: '公告删除成功' });
}));

module.exports = router;

