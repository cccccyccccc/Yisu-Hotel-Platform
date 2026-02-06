const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const Order = require('../models/Order');
const Review = require('../models/Review');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// 商户统计数据 GET /api/merchant/stats
router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'merchant') {
    throw new AppError('权限不足', 403, 'FORBIDDEN');
  }

  const merchantId = req.user.userId;

  // 获取商户的所有酒店
  const hotels = await Hotel.find({ merchantId });
  const hotelIds = hotels.map(h => h._id);

  // 酒店统计
  const totalHotels = hotels.length;
  const publishedHotels = hotels.filter(h => h.status === 1).length;
  const pendingHotels = hotels.filter(h => h.status === 0).length;

  // 本月时间范围
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 本月订单统计
  const monthlyOrders = await Order.find({
    hotelId: { $in: hotelIds },
    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
  });

  const totalMonthlyOrders = monthlyOrders.length;
  const totalMonthlyRevenue = monthlyOrders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  // 本月评价统计
  const monthlyReviews = await Review.find({
    hotelId: { $in: hotelIds },
    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
  });

  const totalMonthlyReviews = monthlyReviews.length;

  // 获取最新5条评价
  const latestReviews = await Review.find({ hotelId: { $in: hotelIds } })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'username avatar')
    .populate('hotelId', 'name');

  // 总订单和收入
  const allOrders = await Order.find({ hotelId: { $in: hotelIds } });
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  // 总评价数和平均评分
  const allReviews = await Review.find({ hotelId: { $in: hotelIds } });
  const totalReviews = allReviews.length;
  const averageRating = totalReviews > 0
    ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : 0;

  res.json({
    hotels: {
      total: totalHotels,
      published: publishedHotels,
      pending: pendingHotels
    },
    orders: {
      total: totalOrders,
      monthly: totalMonthlyOrders,
      totalRevenue,
      monthlyRevenue: totalMonthlyRevenue
    },
    reviews: {
      total: totalReviews,
      monthly: totalMonthlyReviews,
      averageRating: parseFloat(averageRating)
    },
    latestReviews: latestReviews.map(r => ({
      _id: r._id,
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt,
      user: r.userId ? {
        username: r.userId.username,
        avatar: r.userId.avatar
      } : null,
      hotel: r.hotelId ? {
        name: r.hotelId.name
      } : null
    }))
  });
}));

module.exports = router;
