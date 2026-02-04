const express = require('express');
const router = express.Router();
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');

// 添加房型 (POST /api/rooms)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ msg: '权限不足' });
        }

        // 解构字段：必须包含 stock
        const { hotelId, title, price, stock, capacity, bedInfo, size, images } = req.body;

        // 基础非空校验
        if (!hotelId || !title || !price || stock === undefined) {
            return res.status(400).json({ msg: '酒店ID、标题、价格和库存为必填项' });
        }

        if (!mongoose.Types.ObjectId.isValid(hotelId)) {
            return res.status(400).json({ msg: '无效的酒店ID格式' });
        }

        // 验证酒店归属权
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) return res.status(404).json({ msg: '酒店不存在' });
        if (hotel.merchantId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: '无权操作此酒店' });
        }

        // 创建房型
        const newRoom = new RoomType({
            hotelId, title, price, stock, capacity, bedInfo, size, images
        });
        await newRoom.save();

        res.json(newRoom);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 获取某酒店的所有房型 (GET /api/rooms/:hotelId)
router.get('/:hotelId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.hotelId)) {
            return res.status(400).json({ msg: 'Invalid ID' });
        }

        const rooms = await RoomType.find({ hotelId: String(req.params.hotelId) }).sort({ price: 1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 删除房型 (DELETE /api/rooms/:id)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID' });
        }

        const room = await RoomType.findById(req.params.id);
        if (!room) return res.status(404).json({ msg: '房型不存在' });
        // 查酒店验证权限
        const hotel = await Hotel.findById(room.hotelId);

        if (hotel && hotel.merchantId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: '无权删除' });
        }

        await RoomType.findByIdAndDelete(req.params.id);
        res.json({ msg: '删除成功' });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});


// 修改房型 (PUT /api/rooms/:id)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        // 角色检查
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ msg: '权限不足' });
        }

        // ID 格式检查
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID' });
        }

        // 查找房型
        const room = await RoomType.findById(req.params.id);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 验证归属权 (查关联酒店)
        const hotel = await Hotel.findById(room.hotelId);
        // 如果找不到酒店，或者酒店的商户ID与当前请求用户不符
        if (!hotel || hotel.merchantId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: '无权操作此酒店的房型' });
        }

        // 提取允许修改的字段
        // 注意：不允许直接通过此接口修改 hotelId，防止将房型移动到其他酒店
        const { title, price, stock, capacity, bedInfo, size, images, originalPrice } = req.body;

        const updateFields = {};
        if (title) updateFields.title = title;
        // 使用 undefined 判断，允许设置为 0
        if (price !== undefined) updateFields.price = price;
        if (stock !== undefined) updateFields.stock = stock;
        if (capacity !== undefined) updateFields.capacity = capacity;
        if (bedInfo) updateFields.bedInfo = bedInfo;
        if (size) updateFields.size = size;
        if (images) updateFields.images = images;
        if (originalPrice !== undefined) updateFields.originalPrice = originalPrice;

        // 执行更新
        const updatedRoom = await RoomType.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true } // new: true 返回修改后的文档
        );

        res.json(updatedRoom);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});



// 设置/更新价格日历 (PUT /api/rooms/:id/calendar)
// 场景：商户在后台点击日历，设置 "2026-10-01" 的价格为 999 元
router.put('/:id/calendar', authMiddleware, async (req, res) => {
    try {
        // 权限与参数校验
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ msg: '权限不足' });
        }

        // calendarData 示例: [{ date: '2026-10-01', price: 999 }, { date: '2026-10-02', price: 1099 }]
        const { calendarData } = req.body;
        if (!Array.isArray(calendarData)) {
            return res.status(400).json({ msg: '数据格式错误，应为数组' });
        }

        const room = await RoomType.findById(req.params.id);
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 验证归属权
        const hotel = await Hotel.findById(room.hotelId);
        if (!hotel || hotel.merchantId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: '无权操作此酒店' });
        }

        //更新逻辑
        // 策略：遍历上传的日期，如果已存在则覆盖，不存在则追加
        // 也可以选择直接全量替换，视前端实现而定。这里采用“合并更新”策略更灵活。

        let currentCalendar = room.priceCalendar || [];

        calendarData.forEach(newItem => {
            // 简单校验日期格式 (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(newItem.date)) return;

            const existingIndex = currentCalendar.findIndex(item => item.date === newItem.date);
            if (existingIndex > -1) {
                // 如果该日期已有特殊价格，更新它
                currentCalendar[existingIndex].price = newItem.price;
                if (newItem.stock !== undefined) currentCalendar[existingIndex].stock = newItem.stock;
            } else {
                // 否则添加新的日期价格
                currentCalendar.push({
                    date: newItem.date,
                    price: newItem.price,
                    stock: newItem.stock // 可选
                });
            }
        });

        room.priceCalendar = currentCalendar;
        await room.save();

        res.json({ msg: '价格日历更新成功', priceCalendar: room.priceCalendar });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 获取价格日历 (GET /api/rooms/:id/calendar)
// 场景：用户端在详情页打开日历组件，查看未来30天的价格
router.get('/:id/calendar', async (req, res) => {
    try {
        const room = await RoomType.findById(req.params.id).select('priceCalendar price');
        if (!room) return res.status(404).json({ msg: '房型不存在' });

        // 这里的逻辑是：
        // 前端日历组件默认显示 room.price (基础价)
        // 如果 priceCalendar 中有某天的记录，则前端覆盖显示为特殊价格
        res.json({
            basePrice: room.price,
            calendar: room.priceCalendar || []
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});
module.exports = router;