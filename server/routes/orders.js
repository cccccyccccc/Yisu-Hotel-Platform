const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');


// 创建订单 (POST /api/orders)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { hotelId, roomTypeId, checkInDate, checkOutDate, quantity } = req.body;

        // 查找房型获取单价 (后端计算总价才安全)
        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 计算入住天数
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        // 计算时间差(毫秒) -> 转为天数
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return res.status(400).json({ msg: '离店日期必须晚于入住日期' });

        // 计算总价 = 单价 * 房间数 * 天数
        const totalPrice = room.price * (quantity || 1) * diffDays;

        // 创建订单
        const newOrder = new Order({
            userId: req.user.userId, // 从 Token 获取
            hotelId,
            roomTypeId,
            checkInDate,
            checkOutDate,
            quantity: quantity || 1,
            totalPrice, // 存入计算后的总价
            status: 'paid' // 简化逻辑：默认直接算已支付
        });

        await newOrder.save();
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