const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');

// 修改 POST /api/orders 接口
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { hotelId, roomTypeId, checkInDate, checkOutDate, quantity = 1 } = req.body;

        // 查房型
        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 库存检查
        if (room.stock < quantity) {
            return res.status(400).json({ msg: '该房型库存不足，请选择其他房型' });
        }

        // 计算天数和总价
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return res.status(400).json({ msg: '日期无效' });

        const totalPrice = room.price * quantity * diffDays;

        // 创建订单
        const newOrder = new Order({
            userId: req.user.userId,
            hotelId,
            roomTypeId,
            checkInDate,
            checkOutDate,
            quantity,
            totalPrice,
            status: 'paid'
        });
        await newOrder.save();

        // 扣减库存
        room.stock = room.stock - quantity;
        await room.save();

        res.json(newOrder);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 获取我的订单列表 (GET /api/orders/my)
router.get('/my', authMiddleware, async (req, res) => {
    try {
        // 查询该用户的所有订单，按时间倒序
        const orders = await Order.find({ userId: req.user.userId })
            .populate('hotelId', 'name address')   // 关联查询：把 hotelId 变成 { name: 'xxx', address: 'xxx' }
            .populate('roomTypeId', 'title images') // 关联查询：把 roomTypeId 变成 { title: 'xxx' }
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});


// 取消订单 (PUT /api/orders/:id/cancel)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: '订单不存在' });

        // 只能取消自己的订单
        if (order.userId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: '无权操作' });
        }
        order.status = 'cancelled';
        await order.save();
        res.json(order);
    } catch (err) {
        res.status(500).json({ msg: '服务器错误' });
    }
});

module.exports = router;