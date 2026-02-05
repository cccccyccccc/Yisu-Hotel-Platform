const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { orderValidators } = require('../middleware/validators');

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
router.post('/', authMiddleware, orderValidators.create, asyncHandler(async (req, res) => {
    const { checkInDate, checkOutDate, quantity = 1 } = req.body;

    const roomTypeId = req.body.roomTypeId ? String(req.body.roomTypeId) : null;
    const hotelId = req.body.hotelId ? String(req.body.hotelId) : null;

    if (Number(quantity) <= 0) {
        throw new AppError('数量必须大于0', 400, 'INVALID_QUANTITY');
    }

    const start = new Date(checkInDate ? String(checkInDate) : null);
    const end = new Date(checkOutDate ? String(checkOutDate) : null);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
        throw new AppError('日期无效', 400, 'INVALID_DATE');
    }

    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
        throw new AppError('日期无效', 400, 'INVALID_DATE');
    }

    const room = await RoomType.findById(roomTypeId);
    if (!room) {
        throw new AppError('房型不存在', 404, 'ROOM_NOT_FOUND');
    }

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
        throw new AppError(preResult.reason, 400, 'INSUFFICIENT_STOCK');
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
        throw new AppError('抢购失败，库存不足', 400, 'INSUFFICIENT_STOCK');
    }

    res.json(newOrder);
}));


// 获取我的订单 (GET /api/orders/my)
router.get('/my', authMiddleware, asyncHandler(async (req, res) => {
    const orders = await Order.find({ userId: req.user.userId })
        .populate('hotelId', 'name city')
        .populate('roomTypeId', 'title images')
        .sort({ createdAt: -1 });
    res.json(orders);
}));


// 取消订单 (PUT /api/orders/:id/cancel)
router.put('/:id/cancel', authMiddleware, orderValidators.cancel, asyncHandler(async (req, res) => {
    const orderId = String(req.params.id);
    const order = await Order.findById(orderId);

    if (!order) {
        throw new AppError('订单不存在', 404, 'ORDER_NOT_FOUND');
    }
    if (order.userId.toString() !== req.user.userId) {
        throw new AppError('无权操作', 403, 'FORBIDDEN');
    }

    if (['paid', 'pending'].includes(order.status)) {
        order.status = 'cancelled';
        await order.save();
        res.json(order);
    } else {
        throw new AppError('无法取消', 400, 'CANNOT_CANCEL');
    }
}));

module.exports = router;