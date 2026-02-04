const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');

// 创建订单 (POST /api/orders)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { hotelId, roomTypeId, checkInDate, checkOutDate, quantity = 1 } = req.body;

        if (Number(quantity) <= 0) {
            return res.status(400).json({ msg: '预订数量必须大于 0' });
        }

        // 日期校验
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return res.status(400).json({ msg: '日期无效' });

        // 初始房型检查
        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 生成日期列表
        const checkDates = [];
        let cur = new Date(start);
        while (cur < end) {
            checkDates.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }

        // 核心策略：乐观锁 / 后置校验 (Post-Save Validation)
        // 先尝试生成并保存订单 (占坑)
        const totalPrice = room.price * quantity * diffDays; // 简化价格计算

        const newOrder = new Order({
            userId: req.user.userId,
            hotelId,
            roomTypeId,
            checkInDate: start,
            checkOutDate: end,
            quantity,
            totalPrice,
            status: 'paid'
        });

        await newOrder.save();

        // 双重检查：保存后，立即检查是否超售
        // 查出该时间段所有有效订单，按创建时间排序 (先到先得)
        const overlappingOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).sort({ createdAt: 1, _id: 1 });// 按时间排序

        let isOverSold = false;
        let failureReason = '';

        for (const dateObj of checkDates) {
            const dateStr = dateObj.toISOString().split('T')[0];

            let dailyLimit = room.stock;
            if (room.priceCalendar) {
                const cal = room.priceCalendar.find(c => c.date === dateStr);
                if (cal && cal.stock !== undefined) dailyLimit = cal.stock;
            }

            let currentUsage = 0;
            for (const order of overlappingOrders) {
                const oStart = new Date(order.checkInDate);
                const oEnd = new Date(order.checkOutDate);
                if (dateObj >= oStart && dateObj < oEnd) {
                    currentUsage += order.quantity;
                    if (currentUsage > dailyLimit) {
                        if (order._id.toString() === newOrder._id.toString()) {
                            isOverSold = true;
                            failureReason = `日期 ${dateStr} 库存不足`;
                            break;
                        }
                    }
                }
            }
            if (isOverSold) break;
        }

        // 裁决
        if (isOverSold) {
            // 撤销操作：删除刚才创建的订单
            await Order.findByIdAndDelete(newOrder._id);
            return res.status(400).json({ msg: failureReason || '库存不足，抢购失败' });
        }

        // 一切正常，返回成功
        res.json(newOrder);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});


// 获取我的订单 (GET /api/orders/my)
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.userId })
            .populate('hotelId', 'name city')
            .populate('roomTypeId', 'title images')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});


// 取消订单 (PUT /api/orders/:id/cancel)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: '订单不存在' });
        if (order.userId.toString() !== req.user.userId) return res.status(403).json({ msg: '无权操作' });

        if (['paid', 'pending'].includes(order.status)) {
            order.status = 'cancelled';
            await order.save();
            res.json(order);
        } else {
            res.status(400).json({ msg: '无法取消' });
        }
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;