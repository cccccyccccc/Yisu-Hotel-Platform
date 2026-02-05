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

function getDailyLimit(room, dateStr) {
    let limit = room.stock;
    if (room.priceCalendar) {
        const cal = room.priceCalendar.find(c => c.date === dateStr);
        // 注意 0 也是有效库存，必须判断 undefined
        if (cal?.stock !== undefined) {
            limit = cal.stock;
        }
    }
    return limit;
}

function checkPreAvailability(room, existingOrders, quantity, checkDates) {
    for (const dateObj of checkDates) {
        const dateStr = dateObj.toISOString().split('T')[0];
        const dailyLimit = getDailyLimit(room, dateStr);

        // 使用 reduce 计算当日已用总量
        const currentUsage = existingOrders.reduce((total, order) => {
            const oStart = new Date(order.checkInDate);
            const oEnd = new Date(order.checkOutDate);
            if (dateObj >= oStart && dateObj < oEnd) {
                return total + order.quantity;
            }
            return total;
        }, 0);

        if (currentUsage + quantity > dailyLimit) {
            return { success: false, reason: `日期 ${dateStr} 库存不足` };
        }
    }
    return { success: true };
}

function checkPostAvailability(room, sortedOrders, myOrderId, checkDates) {
    for (const dateObj of checkDates) {
        const dateStr = dateObj.toISOString().split('T')[0];
        const dailyLimit = getDailyLimit(room, dateStr);

        let runningTotal = 0;

        for (const order of sortedOrders) {
            const oStart = new Date(order.checkInDate);
            const oEnd = new Date(order.checkOutDate);

            if (dateObj >= oStart && dateObj < oEnd) {
                runningTotal += order.quantity;

                // 如果累加到现在已经超标了
                if (runningTotal > dailyLimit) {
                    // 如果当前累加到的订单正好是"我"，说明是我把库存挤爆的 -> 我得走人
                    if (order._id.toString() === myOrderId.toString()) {
                        return { success: false, reason: `日期 ${dateStr} 库存不足` };
                    }
                    // 如果是别人(排在我后面的人)挤爆的，我不受影响，继续循环
                }
            }
        }
    }
    return { success: true };
}

// 创建订单 (POST /api/orders)
// 使用原子操作(Atomic Operation)进行双重校验，彻底解决并发超卖
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { checkInDate, checkOutDate, quantity = 1 } = req.body;

        // 安全转换与校验
        // 强制转 String 防止 NoSQL 注入
        const hotelId = req.body.hotelId ? String(req.body.hotelId) : null;
        const roomTypeId = req.body.roomTypeId ? String(req.body.roomTypeId) : null;

        if (Number(quantity) <= 0) return res.status(400).json({ msg: '数量必须大于0' });

        // 强制转 Date 防止对象注入
        const start = new Date(checkInDate ? String(checkInDate) : null);
        const end = new Date(checkOutDate ? String(checkOutDate) : null);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ msg: '日期无效' });
        }

        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return res.status(400).json({ msg: '日期无效' });

        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        const checkDates = getDateRange(start, end);

        // 第一轮检查 (Pre-Check)
        // 目的：快速拦截明显库存不足的请求，减少数据库写入压力
        const preOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        });

        const preResult = checkPreAvailability(room, preOrders, quantity, checkDates);
        if (!preResult.success) {
            return res.status(400).json({ msg: preResult.reason });
        }

        // 写入订单 (占位)
        const totalPrice = room.price * quantity * diffDays;
        const newOrder = new Order({
            userId: req.user.userId,
            hotelId, roomTypeId, checkInDate: start, checkOutDate: end,
            quantity, totalPrice, status: 'paid'
        });
        await newOrder.save();

        // 第二轮检查 (Post-Check)
        // 目的：利用数据库原子写入顺序和 _id 排序，解决并发竞态条件
        const postOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).sort({ createdAt: 1, _id: 1 }); // 关键排序

        const postResult = checkPostAvailability(room, postOrders, newOrder._id, checkDates);

        if (!postResult.success) {
            // 抢购失败，回滚删除
            await Order.findByIdAndDelete(newOrder._id);
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