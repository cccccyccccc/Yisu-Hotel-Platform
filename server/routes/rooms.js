const express = require('express');
const router = express.Router();
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { roomValidators } = require('../middleware/validators');

// 添加房型 (POST /api/rooms)
router.post('/', authMiddleware, roomValidators.create, asyncHandler(async (req, res) => {
    if (req.user.role !== 'merchant') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }

    // 解构字段：必须包含 stock
    const { hotelId, title, price, stock, capacity, bedInfo, size, images } = req.body;
    // 基础非空校验已由 validator 处理

    // 验证酒店归属权
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
        throw new AppError('酒店不存在', 404, 'HOTEL_NOT_FOUND');
    }
    if (hotel.merchantId.toString() !== req.user.userId) {
        throw new AppError('无权操作此酒店', 403, 'FORBIDDEN');
    }

    // 创建房型
    const newRoom = new RoomType({
        hotelId, title, price, stock, capacity, bedInfo, size, images
    });
    await newRoom.save();

    res.json(newRoom);
}));

// 获取某酒店的所有房型 (GET /api/rooms/:hotelId)
router.get('/:hotelId', asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.hotelId)) {
        throw new AppError('Invalid ID', 400, 'INVALID_ID');
    }

    const rooms = await RoomType.find({ hotelId: String(req.params.hotelId) }).sort({ price: 1 });
    res.json(rooms);
}));

// 删除房型 (DELETE /api/rooms/:id)
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new AppError('Invalid ID', 400, 'INVALID_ID');
    }

    const room = await RoomType.findById(req.params.id);
    if (!room) {
        throw new AppError('房型不存在', 404, 'ROOM_NOT_FOUND');
    }
    // 查酒店验证权限
    const hotel = await Hotel.findById(room.hotelId);

    if (hotel && hotel.merchantId.toString() !== req.user.userId) {
        throw new AppError('无权删除', 403, 'FORBIDDEN');
    }

    await RoomType.findByIdAndDelete(req.params.id);
    res.json({ msg: '删除成功' });
}));


// 修改房型 (PUT /api/rooms/:id)
router.put('/:id', authMiddleware, roomValidators.update, asyncHandler(async (req, res) => {
    // 角色检查
    if (req.user.role !== 'merchant') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }
    // ID 格式检查由 validator param('id').isMongoId() 处理

    // 查找房型
    const room = await RoomType.findById(req.params.id);
    if (!room) {
        throw new AppError('房型不存在', 404, 'ROOM_NOT_FOUND');
    }

    // 验证归属权 (查关联酒店)
    const hotel = await Hotel.findById(room.hotelId);
    // 如果找不到酒店，或者酒店的商户ID与当前请求用户不符
    if (!hotel || hotel.merchantId.toString() !== req.user.userId) {
        throw new AppError('无权操作此酒店的房型', 403, 'FORBIDDEN');
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
}));



// 设置/更新价格日历 (PUT /api/rooms/:id/calendar)
// 场景：商户在后台点击日历，设置 "2026-10-01" 的价格为 999 元
// 设置/更新价格日历 (PUT /api/rooms/:id/calendar)
router.put('/:id/calendar', authMiddleware, roomValidators.calendar, asyncHandler(async (req, res) => {
    // 权限校验
    if (req.user.role !== 'merchant') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }

    const { calendarData } = req.body;
    // 数据格式验证由 validator 处理

    const room = await RoomType.findById(req.params.id);
    if (!room) {
        throw new AppError('房型不存在', 404, 'ROOM_NOT_FOUND');
    }

    // 验证归属权
    const hotel = await Hotel.findById(room.hotelId);
    if (!hotel || hotel.merchantId.toString() !== req.user.userId) {
        throw new AppError('无权操作此酒店', 403, 'FORBIDDEN');
    }

    //更新逻辑
    let currentCalendar = room.priceCalendar || [];

    calendarData.forEach(newItem => {
        // 简单校验日期格式 (YYYY-MM-DD) - Validator 已经做了，这里可以保留或移除
        // if (!/^\d{4}-\d{2}-\d{2}$/.test(newItem.date)) return;

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
}));

// 获取价格日历 (GET /api/rooms/:id/calendar)
router.get('/:id/calendar', asyncHandler(async (req, res) => {
    const room = await RoomType.findById(req.params.id).select('priceCalendar price');
    if (!room) {
        throw new AppError('房型不存在', 404, 'ROOM_NOT_FOUND');
    }

    // 这里的逻辑是：
    // 前端日历组件默认显示 room.price (基础价)
    // 如果 priceCalendar 中有某天的记录，则前端覆盖显示为特殊价格
    res.json({
        basePrice: room.price,
        calendar: room.priceCalendar || []
    });
}));
module.exports = router;