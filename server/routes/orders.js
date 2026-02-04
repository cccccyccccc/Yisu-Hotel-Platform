const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');

function getDateRange(start, end) {
    const dates = [];
    let cur = new Date(start);
    while (cur < end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

function checkOverSold(room, overlappingOrders, newOrderId, checkDates) {
    for (const dateObj of checkDates) {
        const dateStr = dateObj.toISOString().split('T')[0];
        let dailyLimit = room.stock;
        if (room.priceCalendar) {
            const cal = room.priceCalendar.find(c => c.date === dateStr);
            if (cal && cal.stock !== undefined) dailyLimit = cal.stock;
        }
        let currentUsage = 0;
        let isMyOrderIncluded = false;
        for (const order of overlappingOrders) {
            const oStart = new Date(order.checkInDate);
            const oEnd = new Date(order.checkOutDate);
            const isMe = order._id.toString() === newOrderId.toString();
            if (dateObj >= oStart && dateObj < oEnd) {
                currentUsage += order.quantity;
                if (currentUsage > dailyLimit) {
                    if (isMe) {
                        return { isOverSold: true, reason: `日期 ${dateStr} 库存不足` };
                    }
                } else {
                    if (isMe) {
                        isMyOrderIncluded = true;
                    }
                }
            }
        }
    }
    return { isOverSold: false };
}

// 创建订单 (POST /api/orders)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { hotelId, roomTypeId, checkInDate, checkOutDate, quantity = 1 } = req.body;

        // 参数校验
        if (Number(quantity) <= 0) return res.status(400).json({ msg: '数量必须大于0' });
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return res.status(400).json({ msg: '日期无效' });

        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 乐观锁占位
        const totalPrice = room.price * quantity * diffDays;
        const newOrder = new Order({
            userId: req.user.userId,
            hotelId, roomTypeId, checkInDate: start, checkOutDate: end,
            quantity, totalPrice, status: 'paid'
        });
        await newOrder.save();

        // 双重检查 (Double Check)
        // 使用 _id 辅助排序，保证即便毫秒级时间戳相同，顺序也是固定的
        const overlappingOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).sort({ createdAt: 1, _id: 1 });

        const checkDates = getDateRange(start, end);
        const checkResult = checkOverSold(room, overlappingOrders, newOrder._id, checkDates);

        // 裁决
        if (checkResult.isOverSold) {
            await Order.findByIdAndDelete(newOrder._id);
            return res.status(400).json({ msg: checkResult.reason || '抢购失败' });
        }
        res.json(newOrder);
    } catch (err) {
        if (process.env.NODE_ENV !== 'test') console.error('Order Error:', err.message);
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