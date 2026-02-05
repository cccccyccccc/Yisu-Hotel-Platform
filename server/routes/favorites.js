const express = require('express');
const router = express.Router();
const Favorite = require('../models/Favorite');
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { favoriteValidators } = require('../middleware/validators');

// 收藏酒店 (POST /api/favorites/:hotelId)
router.post('/:hotelId', authMiddleware, favoriteValidators.hotelIdParam, asyncHandler(async (req, res) => {
    const hotelId = String(req.params.hotelId);
    // 格式校验由 validator 完成

    // 验证酒店是否存在
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
        throw new AppError('酒店不存在', 404, 'HOTEL_NOT_FOUND');
    }

    const userId = String(req.user.userId);
    // 防止重复收藏 (虽然数据库有索引兜底，但这里先查一次反馈更友好的错误)
    const existing = await Favorite.findOne({ userId: userId, hotelId });
    if (existing) {
        throw new AppError('您已收藏过该酒店', 400, 'ALREADY_FAVORITED');
    }

    await Favorite.create({ userId: req.user.userId, hotelId });
    res.status(201).json({ msg: '收藏成功' });
}));

// 取消收藏 (DELETE /api/favorites/:hotelId)
router.delete('/:hotelId', authMiddleware, favoriteValidators.hotelIdParam, asyncHandler(async (req, res) => {
    const hotelId = String(req.params.hotelId);
    const userId = String(req.user.userId);

    const result = await Favorite.findOneAndDelete({
        userId: userId,
        hotelId: hotelId
    });

    if (!result) {
        throw new AppError('未找到收藏记录', 404, 'FAVORITE_NOT_FOUND');
    }
    res.json({ msg: '已取消收藏' });
}));

// 获取我的收藏列表 (GET /api/favorites)
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const userId = String(req.user.userId);
    const favorites = await Favorite.find({ userId: userId })
        .populate('hotelId') // 关键：自动把 hotelId 变成酒店的详细信息对象
        .sort({ createdAt: -1 });

    // 过滤掉已下架或删除的酒店 (防止前端报错)
    const validFavorites = favorites.filter(f => f.hotelId !== null);

    res.json(validFavorites);
}));

// 检查某酒店是否已收藏 (GET /api/favorites/check/:hotelId)
// 用于详情页：判断当前用户是否收藏过该酒店，决定显示实心还是空心红心
// 检查某酒店是否已收藏 (GET /api/favorites/check/:hotelId)
// 用于详情页：判断当前用户是否收藏过该酒店，决定显示实心还是空心红心
router.get('/check/:hotelId', authMiddleware, favoriteValidators.hotelIdParam, asyncHandler(async (req, res) => {
    const userId = String(req.user.userId);
    const hotelId = String(req.params.hotelId);
    const existing = await Favorite.findOne({
        userId: userId,
        hotelId: hotelId
    });
    res.json({ isFavorite: !!existing });
}));

module.exports = router;