const express = require('express');
const router = express.Router();
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');

// 添加房型 (POST /api/rooms)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ msg: '权限不足' });
        }

        // 解构字段：必须包含 stock
        const { hotelId, title, price, stock, capacity, bedInfo, size, images } = req.body;

        // 基础非空校验
        if (!hotelId || !title || !price || stock === undefined) {
            return res.status(400).json({ msg: '酒店ID、标题、价格和库存为必填项' });
        }

        if (!mongoose.Types.ObjectId.isValid(hotelId)) {
            return res.status(400).json({ msg: '无效的酒店ID格式' });
        }

        // 验证酒店归属权
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) return res.status(404).json({ msg: '酒店不存在' });
        if (hotel.merchantId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: '无权操作此酒店' });
        }

        // 创建房型
        const newRoom = new RoomType({
            hotelId, title, price, stock, capacity, bedInfo, size, images
        });
        await newRoom.save();

        res.json(newRoom);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 获取某酒店的所有房型 (GET /api/rooms/:hotelId)
router.get('/:hotelId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.hotelId)) {
            return res.status(400).json({ msg: 'Invalid ID' });
        }

        const rooms = await RoomType.find({ hotelId: req.params.hotelId }).sort({ price: 1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 删除房型 (DELETE /api/rooms/:id)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID' });
        }

        const room = await RoomType.findById(req.params.id);
        if (!room) return res.status(404).json({ msg: '房型不存在' });
        // 查酒店验证权限
        const hotel = await Hotel.findById(room.hotelId);

        if (hotel && hotel.merchantId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: '无权删除' });
        }

        await RoomType.findByIdAndDelete(req.params.id);
        res.json({ msg: '删除成功' });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;