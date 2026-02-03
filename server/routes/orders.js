const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');

// 创建订单 (POST /api/orders)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { hotelId, roomTypeId, checkInDate, checkOutDate, quantity = 1 } = req.body;
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return res.status(400).json({ msg: '离店日期必须晚于入住日期' });
        }
        const room = await RoomType.findOneAndUpdate(
            { _id: roomTypeId, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { new: true }
        );
        if (!room) {
            const checkRoom = await RoomType.findById(roomTypeId);
            if (!checkRoom) {
                return res.status(404).json({ msg: '房型不存在' });
            } else {
                return res.status(400).json({ msg: '该房型库存不足，请选择其他房型' });
            }
        }

        try {
            const totalPrice = room.price * quantity * diffDays;

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
            res.json(newOrder);

        } catch (err) {
            //  补偿机制：如果订单创建失败（比如数据库挂了），必须把库存加回去！
            await RoomType.findByIdAndUpdate(roomTypeId, { $inc: { stock: quantity } });
            throw err; // 继续抛出错误给外层处理
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});


// 获取我的订单列表 (GET /api/orders/my)
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.userId })
            .populate('hotelId', 'name address')
            .populate('roomTypeId', 'title images')
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

        if (order.userId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: '无权操作' });
        }

        // 状态流转：只有已支付的订单才能取消并退库存
        if (order.status === 'paid') {
            order.status = 'cancelled';
            await order.save();
            await RoomType.findByIdAndUpdate(order.roomTypeId, {
                $inc: { stock: order.quantity }
            });

            res.json(order);
        } else {
            return res.status(400).json({ msg: '当前订单状态无法取消' });
        }

    } catch (err) {
        res.status(500).json({ msg: '服务器错误' });
    }
});

module.exports = router;