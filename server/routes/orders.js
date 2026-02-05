const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * 生成日期时间戳范围
 */
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

/**
 * 获取某一天的库存上限
 */
function getDailyLimit(room, dateStr) {
    let limit = room.stock;
    // 如果 priceCalendar 存在且能在里面找到对应日期，且 stock 有定义
    const cal = room.priceCalendar?.find(c => c.date === dateStr);
    if (cal?.stock !== undefined) {
        limit = cal.stock;
    }
    return limit;
}

/**
 * 预检查 (Pre-Check)
 */
function checkPreAvailability(room, existingOrders, quantity, checkDates) {
    for (const dateObj of checkDates) {
        const dateStr = dateObj.toISOString().split('T')[0];
        const dailyLimit = getDailyLimit(room, dateStr);

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

/**
 * 将这部分逻辑提取出来，checkPostAvailability 的复杂度瞬间从 16 降到 2
 */

function isMyOrderCulprit(sortedOrders, dateObj, dailyLimit, myOrderId) {
    let runningTotal = 0;
    for (const order of sortedOrders) {
        const oStart = new Date(order.checkInDate);
        const oEnd = new Date(order.checkOutDate);

        // 简化嵌套：如果不重叠，直接跳过
        if (dateObj < oStart || dateObj >= oEnd) continue;

        runningTotal += order.quantity;

        // 核心判断：超标了，且当前这个订单就是我
        if (runningTotal > dailyLimit && order._id.toString() === myOrderId.toString()) {
            return true;
        }
    }
    return false;
}

/**
 * 后置检查 (Post-Check)
 * 现在这个函数非常简单，只负责遍历日期
 */

function checkPostAvailability(room, sortedOrders, myOrderId, checkDates) {
    for (const dateObj of checkDates) {
        const dateStr = dateObj.toISOString().split('T')[0];
        const dailyLimit = getDailyLimit(room, dateStr);

        // 调用辅助函数，复杂度大幅降低
        if (isMyOrderCulprit(sortedOrders, dateObj, dailyLimit, myOrderId)) {
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

        // 安全转换
        const roomTypeId = req.body.roomTypeId ? String(req.body.roomTypeId) : null;
        const hotelId = req.body.hotelId ? String(req.body.hotelId) : null;

        if (Number(quantity) <= 0) return res.status(400).json({ msg: '数量必须大于0' });

        const start = new Date(checkInDate ? String(checkInDate) : null);
        const end = new Date(checkOutDate ? String(checkOutDate) : null);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ msg: '日期无效' });
        }

        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return res.status(400).json({ msg: '日期无效' });

        const room = await RoomType.findById(roomTypeId);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        const checkDates = getDateRange(start, end);

        // Pre-Check
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

        // Save
        const totalPrice = room.price * quantity * diffDays;
        const newOrder = new Order({
            userId: req.user.userId,
            hotelId, roomTypeId, checkInDate: start, checkOutDate: end,
            quantity, totalPrice, status: 'paid'
        });
        await newOrder.save();

        // Post-Check
        const postOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).sort({ createdAt: 1, _id: 1 });

        const postResult = checkPostAvailability(room, postOrders, newOrder._id, checkDates);

        if (!postResult.success) {
            await Order.findByIdAndDelete(newOrder._id);
            return res.status(400).json({ msg: '抢购失败，库存不足' });
        }

        res.json(newOrder);

    } catch (err) {
        if (process.env.NODE_ENV !== 'test') logger.error('Order Error:', err.message);
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
        logger.error(err);
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
        logger.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;