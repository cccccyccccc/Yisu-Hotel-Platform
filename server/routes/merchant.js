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

  // 上月时间范围
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // 本月订单统计
  const monthlyOrders = await Order.find({
    hotelId: { $in: hotelIds },
    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
  });

  const totalMonthlyOrders = monthlyOrders.length;
  const totalMonthlyRevenue = monthlyOrders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  // 上月订单统计（用于环比）
  const lastMonthOrders = await Order.find({
    hotelId: { $in: hotelIds },
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });
  const lastMonthRevenue = lastMonthOrders
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

  // 评分分布统计
  const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  allReviews.forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDistribution[Math.floor(r.rating)]++;
    }
  });

  // 近30天每日收入
  const revenueHistory = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

    const dayRevenue = allOrders
      .filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= dayStart && orderDate <= dayEnd &&
          (o.status === 'paid' || o.status === 'completed');
      })
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    revenueHistory.push({
      date: dayStart.toISOString().split('T')[0],
      revenue: dayRevenue
    });
  }

  // 近6个月每日入住率（日历热力图）
  const dailyOccupancy = [];
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (let d = new Date(sixMonthsAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    const dayOrders = allOrders.filter(o => {
      const checkIn = new Date(o.checkInDate);
      const checkOut = new Date(o.checkOutDate);
      return checkIn <= dayEnd && checkOut >= dayStart &&
        (o.status === 'paid' || o.status === 'completed');
    });

    const roomsBooked = dayOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);

    dailyOccupancy.push({
      date: dayStart.toISOString().split('T')[0],
      count: roomsBooked
    });
  }

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
      monthlyRevenue: totalMonthlyRevenue,
      lastMonthRevenue
    },
    reviews: {
      total: totalReviews,
      monthly: totalMonthlyReviews,
      averageRating: Number.parseFloat(averageRating),
      ratingDistribution
    },
    revenueHistory,
    dailyOccupancy,
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
