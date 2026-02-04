const express = require('express');
const router = express.Router();
const Favorite = require('../models/Favorite');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');

// 收藏酒店 (POST /api/favorites/:hotelId)
router.post('/:hotelId', authMiddleware, async (req, res) => {
    try {
        const hotelId = String(req.params.hotelId);

        // 验证酒店是否存在
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) return res.status(404).json({ msg: '酒店不存在' });

        const userId = String(req.user.userId);
        // 防止重复收藏 (虽然数据库有索引兜底，但这里先查一次反馈更友好的错误)
        const existing = await Favorite.findOne({ userId: userId, hotelId });
        if (existing) {
            return res.status(400).json({ msg: '您已收藏过该酒店' });
        }

        await Favorite.create({ userId: req.user.userId, hotelId });
        res.status(201).json({ msg: '收藏成功' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 取消收藏 (DELETE /api/favorites/:hotelId)
router.delete('/:hotelId', authMiddleware, async (req, res) => {
    try {
        const hotelId = String(req.params.hotelId);
        const userId = String(req.user.userId);

        const result = await Favorite.findOneAndDelete({
            userId: userId,
            hotelId: hotelId
        });

        if (!result) return res.status(404).json({ msg: '未找到收藏记录' });
        res.json({ msg: '已取消收藏' });

    } catch (err) {
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 获取我的收藏列表 (GET /api/favorites)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = String(req.user.userId);
        const favorites = await Favorite.find({ userId: userId })
            .populate('hotelId') // 关键：自动把 hotelId 变成酒店的详细信息对象
            .sort({ createdAt: -1 });

        // 过滤掉已下架或删除的酒店 (防止前端报错)
        const validFavorites = favorites.filter(f => f.hotelId !== null);

        res.json(validFavorites);
    } catch (err) {
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 检查某酒店是否已收藏 (GET /api/favorites/check/:hotelId)
// 用于详情页：判断当前用户是否收藏过该酒店，决定显示实心还是空心红心
router.get('/check/:hotelId', authMiddleware, async (req, res) => {
    try {
        const userId = String(req.user.userId);
        const hotelId = String(req.params.hotelId);
        const existing = await Favorite.findOne({
            userId: userId,
            hotelId: hotelId
        });
        res.json({ isFavorite: !!existing });
    } catch (err) {
        res.status(500).json({ msg: '服务器错误' });
    }
});

module.exports = router;