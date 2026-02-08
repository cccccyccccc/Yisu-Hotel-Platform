const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// 获取酒店的有效促销列表 (公开) GET /api/promotions/hotel/:hotelId
router.get('/hotel/:hotelId', asyncHandler(async (req, res) => {
  const { hotelId } = req.params;
  const now = new Date();

  const promotions = await Promotion.find({
    hotelId,
    status: 1,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ createdAt: -1 });

  res.json(promotions);
}));

// 商户：获取自己酒店的所有促销 GET /api/promotions/my
router.get('/my', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'merchant') {
    throw new AppError('权限不足', 403);
  }

  // 获取商户的所有酒店
  const hotels = await Hotel.find({ merchantId: req.user.userId }).select('_id');
  const hotelIds = hotels.map(h => h._id);

  const promotions = await Promotion.find({ hotelId: { $in: hotelIds } })
    .populate('hotelId', 'name')
    .populate('roomTypes', 'title')
    .sort({ createdAt: -1 });

  res.json(promotions);
}));

// 商户：创建促销 POST /api/promotions
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'merchant') {
    throw new AppError('权限不足', 403);
  }

  const { hotelId, title, description, type, discountValue, minAmount, roomTypes, startDate, endDate } = req.body;

  // 验证酒店归属
  const hotel = await Hotel.findOne({ _id: hotelId, merchantId: req.user.userId });
  if (!hotel) {
    throw new AppError('酒店不存在或无权限', 404);
  }

  // 验证折扣值
  if (type === 'discount' && (discountValue <= 0 || discountValue >= 1)) {
    throw new AppError('折扣值应在0.1-0.99之间', 400);
  }
  if ((type === 'amount_off' || type === 'fixed_price') && discountValue <= 0) {
    throw new AppError('金额必须大于0', 400);
  }

  // 验证日期
  if (new Date(startDate) >= new Date(endDate)) {
    throw new AppError('结束日期必须晚于开始日期', 400);
  }

  const promotion = await Promotion.create({
    hotelId,
    title,
    description,
    type,
    discountValue,
    minAmount: minAmount || 0,
    roomTypes: roomTypes || [],
    startDate,
    endDate,
    status: 1
  });

  res.status(201).json({
    msg: '促销活动创建成功',
    data: promotion
  });
}));

// 商户：更新促销 PUT /api/promotions/:id
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'merchant') {
    throw new AppError('权限不足', 403);
  }

  const promotion = await Promotion.findById(req.params.id).populate('hotelId');
  if (!promotion) {
    throw new AppError('促销活动不存在', 404);
  }

  // 验证酒店归属
  if (promotion.hotelId.merchantId.toString() !== req.user.userId) {
    throw new AppError('无权操作此促销', 403);
  }

  const { title, description, type, discountValue, minAmount, roomTypes, startDate, endDate, status } = req.body;

  if (title !== undefined) promotion.title = title;
  if (description !== undefined) promotion.description = description;
  if (type !== undefined) promotion.type = type;
  if (discountValue !== undefined) promotion.discountValue = discountValue;
  if (minAmount !== undefined) promotion.minAmount = minAmount;
  if (roomTypes !== undefined) promotion.roomTypes = roomTypes;
  if (startDate !== undefined) promotion.startDate = startDate;
  if (endDate !== undefined) promotion.endDate = endDate;
  if (status !== undefined) promotion.status = status;

  await promotion.save();

  res.json({
    msg: '促销活动更新成功',
    data: promotion
  });
}));

// 商户：删除促销 DELETE /api/promotions/:id
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'merchant') {
    throw new AppError('权限不足', 403);
  }

  const promotion = await Promotion.findById(req.params.id).populate('hotelId');
  if (!promotion) {
    throw new AppError('促销活动不存在', 404);
  }

  // 验证酒店归属
  if (promotion.hotelId.merchantId.toString() !== req.user.userId) {
    throw new AppError('无权操作此促销', 403);
  }

  await Promotion.findByIdAndDelete(req.params.id);

  res.json({ msg: '促销活动已删除' });
}));

module.exports = router;
