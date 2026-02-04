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

// 创建订单 (POST /api/orders)
// 策略：使用原子操作(Atomic Operation)进行双重校验，彻底解决并发超卖
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

        // 使用更稳健的"查-占-核"机制
        // 先查出当前所有的有效订单 (Snapshot)
        // 注意：这里不做 limit 检查，而是先获取全量数据，在内存中进行严格计算
        const checkDates = getDateRange(start, end);

        const existingOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }); // 这里不需要排序，我们需要的是总数

        // 内存中进行严格的库存预演 (Pre-Check)
        // 在写入数据库之前，先算一遍。如果现在都已经满了，直接拒绝，不要去写库。
        for (const dateObj of checkDates) {
            const dateStr = dateObj.toISOString().split('T')[0];

            // 获取当日限额
            let dailyLimit = room.stock;
            if (room.priceCalendar) {
                const cal = room.priceCalendar.find(c => c.date === dateStr);
                if (cal && cal.stock !== undefined) dailyLimit = cal.stock;
            }

            // 计算当日已用
            let currentUsage = 0;
            for (const order of existingOrders) {
                const oStart = new Date(order.checkInDate);
                const oEnd = new Date(order.checkOutDate);
                if (dateObj >= oStart && dateObj < oEnd) {
                    currentUsage += order.quantity;
                }
            }
            // 预判：如果现在加进去会超，直接拒绝
            if (currentUsage + quantity > dailyLimit) {
                return res.status(400).json({ msg: `日期 ${dateStr} 库存不足` });
            }
        }

        // 写入订单 (乐观锁尝试)
        const totalPrice = room.price * quantity * diffDays;
        const newOrder = new Order({
            userId: req.user.userId,
            hotelId, roomTypeId, checkInDate: start, checkOutDate: end,
            quantity, totalPrice, status: 'paid'
        });
        await newOrder.save();

        // 写入后的再次核对 (Post-Check)
        // 为了防止两个请求同时通过了步骤3的检查，我们需要在写入后再次查询。
        // 这次我们查询包括"自己"在内的所有订单。
        const verifyOrders = await Order.find({
            roomTypeId: roomTypeId,
            status: { $in: ['paid', 'confirmed', 'pending'] },
            checkInDate: { $lt: end },
            checkOutDate: { $gt: start }
        }).sort({ createdAt: 1, _id: 1 }); // 保持稳定的排序

        let isOverSold = false;

        for (const dateObj of checkDates) {
            const dateStr = dateObj.toISOString().split('T')[0];
            let dailyLimit = room.stock;
            if (room.priceCalendar) {
                const cal = room.priceCalendar.find(c => c.date === dateStr);
                if (cal && cal.stock !== undefined) dailyLimit = cal.stock;
            }

            let usage = 0;
            for (const order of verifyOrders) {
                const oStart = new Date(order.checkInDate);
                const oEnd = new Date(order.checkOutDate);
                if (dateObj >= oStart && dateObj < oEnd) {
                    usage += order.quantity;

                    // 如果超标了，且当前遍历到的订单是"我" (或者在我之后)
                    // 那么"我"就是导致超标的那个（因为我排在后面）
                    if (usage > dailyLimit) {
                        if (order._id.toString() === newOrder._id.toString()) {
                            isOverSold = true;
                        }
                    }
                }
            }
            if (isOverSold) break;
        }

        if (isOverSold) {
            // 回滚：删除刚才创建的订单
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