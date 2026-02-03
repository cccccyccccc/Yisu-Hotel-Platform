const express = require('express');
const router = express.Router();
const RoomType = require('../models/RoomType');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');

// 新增房型 (POST /api/rooms)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'merchant') return res.status(403).json({ msg: '无权操作' });

        // 解构字段
        const { hotelId, title, price, capacity, bedInfo, size, images } = req.body;

        // 校验归属权
        const hotel = await Hotel.findById(hotelId);
        if (!hotel || hotel.merchantId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: '无权操作此酒店' });
        }

        const newRoom = new RoomType({
            hotelId, title, price, capacity, bedInfo, size, images
        });
        await newRoom.save();

        // 如果新房型价格比酒店当前起价更低，更新酒店起价
        if (price < hotel.price) {
            hotel.price = price;
            await hotel.save();
        }

        res.json(newRoom);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 获取某酒店的所有房型 (GET /api/rooms/:hotelId) - 公开接口
router.get('/:hotelId', async (req, res) => {
    try {
        // 房型价格从低到高排序
        const rooms = await RoomType.find({ hotelId: req.params.hotelId }).sort({ price: 1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 删除房型 (DELETE /api/rooms/:id)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const room = await RoomType.findById(req.params.id);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        const hotel = await Hotel.findById(room.hotelId);
        if (hotel.merchantId.toString() !== req.user.userId) return res.status(401).json({ msg: '无权操作' });

        await RoomType.findByIdAndDelete(req.params.id);
        res.json({ msg: '已删除' });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;