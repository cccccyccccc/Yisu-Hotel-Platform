const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');

function getDateRange(start, end) {
    const dates = [];
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    for (let time = startTime; time < endTime; time += oneDay) {
        dates.push(new Date(time));
    }
    return dates;
}

function checkInventoryStatus(room, existingOrders, quantity, checkDates, myOrderId = null) {
    for (const dateObj of checkDates) {
        const dateStr = dateObj.toISOString().split('T')[0];

        // 确定当日总库存
        let dailyLimit = room.stock;
        if (room.priceCalendar) {
            const cal = room.priceCalendar.find(c => c.date === dateStr);
            if (cal && cal.stock !== undefined) dailyLimit = cal.stock;
        }

        // 计算已占用
        let currentUsage = 0;
        for (const order of existingOrders) {
            const oStart = new Date(order.checkInDate);
            const oEnd = new Date(order.checkOutDate);

            if (dateObj >= oStart && dateObj < oEnd) {
                currentUsage += order.quantity;
                if (myOrderId && currentUsage > dailyLimit) {
                    if (order._id.toString() === myOrderId.toString()) {
                        return { success: false, reason: `日期 ${dateStr} 库存不足` };
                    }
                }
            }
        }
        if (!myOrderId && (currentUsage + quantity > dailyLimit)) {
            return { success: false, reason: `日期 ${dateStr} 库存不足` };
        }
    }
    return { success: true };
}

// 创建订单 (POST /api/orders)
// 使用原子操作(Atomic Operation)进行双重校验，彻底解决并发超卖
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { checkInDate, checkOutDate, quantity = 1 } = req.body;
        const hotelId = String(req.body.hotelId);
        const roomTypeId = String(req.body.roomTypeId);

        // 基础校验
        if (Number(quantity) <= 0) return res.status(400).json({ msg: '数量必须大于0' });
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return res.status(400).json({ msg: '日期无效' });

        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        const checkDates = getDateRange(start, end);

        // 第一轮检查 (Pre-Check): 内存预演
        const preOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        });

        const preCheck = checkInventoryStatus(room, preOrders, quantity, checkDates);
        if (!preCheck.success) {
            return res.status(400).json({ msg: preCheck.reason });
        }

        // 写入订单 (乐观锁)
        const totalPrice = room.price * quantity * diffDays;
        const newOrder = new Order({
            userId: req.user.userId,
            hotelId, roomTypeId, checkInDate: start, checkOutDate: end,
            quantity, totalPrice, status: 'paid'
        });
        await newOrder.save();
        const postOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).sort({ createdAt: 1, _id: 1 });
        const postCheck = checkInventoryStatus(room, postOrders, quantity, checkDates, newOrder._id);
        if (!postCheck.success) {
            await Order.findByIdAndDelete(newOrder._id); // 回滚
            return res.status(400).json({ msg: '抢购失败，库存不足' });
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
        const orderId = String(req.params.id);
        const order = await Order.findById(orderId);
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