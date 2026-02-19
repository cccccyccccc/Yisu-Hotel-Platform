const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');

const cache = require('../middleware/cache');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { hotelValidators } = require('../middleware/validators');

/**
 * 辅助函数：获取指定日期范围内有空房的酒店ID
 */
async function getAvailableHotelIds(checkIn, checkOut) {
    if (!checkIn || !checkOut) return null;

    const start = new Date(String(checkIn));
    const end = new Date(String(checkOut));

    const overlappingOrders = await Order.find({
        status: { $in: ['paid', 'completed', 'pending'] },
        checkInDate: { $lt: end },
        checkOutDate: { $gt: start }
    }).select('roomTypeId quantity');

    const bookedMap = {};
    overlappingOrders.forEach(order => {
        const rId = order.roomTypeId.toString();
        bookedMap[rId] = (bookedMap[rId] || 0) + order.quantity;
    });

    const allRoomTypes = await RoomType.find({}).select('hotelId stock _id');
    const availableHotelIds = new Set();

    allRoomTypes.forEach(room => {
        const bookedCount = bookedMap[room._id.toString()] || 0;
        if (room.stock > bookedCount) {
            availableHotelIds.add(room.hotelId.toString());
        }
    });

    return Array.from(availableHotelIds);
}

/**
 * 辅助函数：构建查询过滤对象
 */
function buildFilterQuery(query, availableIds) {
    const { city, keyword, starRating, minPrice, maxPrice, tags } = query;
    const dbQuery = { status: 1 };

    if (availableIds !== null) {
        if (availableIds.length === 0) return { _id: null };
        dbQuery._id = { $in: availableIds };
    }

    if (city) dbQuery.city = String(city);
    if (starRating) dbQuery.starRating = Number(starRating);

    if (minPrice || maxPrice) {
        dbQuery.price = {};
        if (minPrice) dbQuery.price.$gte = Number(minPrice);
        if (maxPrice) dbQuery.price.$lte = Number(maxPrice);
    }

    if (keyword) {
        const safeKeyword = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        dbQuery.$or = [
            { name: { $regex: safeKeyword, $options: 'i' } },
            { address: { $regex: safeKeyword, $options: 'i' } }
        ];
    }

    if (tags) {
        const tagsArray = String(tags).split(',').map(t => t.trim()).filter(Boolean);
        if (tagsArray.length > 0) {
            dbQuery.tags = { $all: tagsArray };
        }
    }

    return dbQuery;
}

/**
 * 辅助函数：构建排序逻辑
 */
function buildSortLogic(sortType, userLat, userLng) {
    let sort = {};
    let locationQuery = null;

    if (sortType === 'distance' && userLat && userLng) {
        locationQuery = {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: [Number.parseFloat(userLng), Number.parseFloat(userLat)]
                }
            }
        };
    } else {
        switch (sortType) {
            case 'price_asc': sort = { price: 1 }; break;
            case 'price_desc': sort = { price: -1 }; break;
            case 'score_desc': sort = { score: -1 }; break;
            default: sort = { createdAt: -1 };
        }
    }
    return { sort, locationQuery };
}

// ==========================================
// 路由处理器
// ==========================================

// 发布新酒店 (POST /api/hotels)
router.post('/', authMiddleware, hotelValidators.create, asyncHandler(async (req, res) => {
    if (req.user.role !== 'merchant') throw new AppError('无权限', 403);

    const { name, nameEn, city, address, starRating, price, description, tags, 
            openingTime, location, nearbyAttractions, nearbyTransport, nearbyMalls, images } = req.body;

    const existingHotel = await Hotel.findOne({ name: String(name) });
    if (existingHotel) throw new AppError('酒店名已存在', 400);

    const newHotel = new Hotel({
        merchantId: req.user.userId,
        name, nameEn, city, address, 
        starRating: Number(starRating), 
        price: Number(price), 
        description, tags, openingTime, location, 
        nearbyAttractions, nearbyTransport, nearbyMalls,
        images: images || [], 
        status: 0
    });

    await newHotel.save();
    res.json(newHotel);
}));

// 获取我的酒店列表 (GET /api/hotels/my)
router.get('/my', authMiddleware, asyncHandler(async (req, res) => {
    const hotels = await Hotel.find({ merchantId: req.user.userId })
        .sort({ createdAt: -1 });
    res.json(hotels);
}));

// 管理员：查看所有酒店 (GET /api/hotels/admin/list)
router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }
    const hotels = await Hotel.find()
        .populate('merchantId', 'username')
        .sort({ createdAt: -1 });

    res.json(hotels);
}));

// 首页搜索接口 (GET /api/hotels)
router.get('/', cache(300), hotelValidators.search, asyncHandler(async (req, res) => {
    const { checkInDate, checkOutDate, sortType, userLat, userLng, page = 1, limit = 10 } = req.query;
    const availableIds = await getAvailableHotelIds(checkInDate, checkOutDate);
    const baseQuery = buildFilterQuery(req.query, availableIds);
    const findQuery = { ...baseQuery };
    const countQuery = { ...baseQuery };
    const { sort, locationQuery } = buildSortLogic(sortType, userLat, userLng);

    if (locationQuery) {
        findQuery.location = locationQuery;
    }
    const pageNum = Math.max(1, Number.parseInt(page));
    const limitNum = Math.max(1, Number.parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    try {
        const [hotels, total] = await Promise.all([
            Hotel.find(findQuery).sort(sort).skip(skip).limit(limitNum),
            Hotel.countDocuments(countQuery)
        ]);

        res.json({
            data: hotels,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        if (err.message?.includes('index')) {
            throw new AppError('LBS Index Missing', 500, 'INDEX_MISSING');
        }
        throw err;
    }
}));

// 获取单个酒店详情 (GET /api/hotels/:id)
router.get('/:id', asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new AppError('Invalid ID format', 400, 'INVALID_ID');
    }

    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
        throw new AppError('Not Found', 404, 'NOT_FOUND');
    }
    res.json(hotel);
}));

// 商户修改酒店信息 (PUT /api/hotels/:id)
router.put('/:id', authMiddleware, hotelValidators.update, asyncHandler(async (req, res) => {
    const { 
        name, nameEn, city, address, starRating, price, description, tags, 
        openingTime, location, nearbyAttractions, nearbyTransport, nearbyMalls, images 
    } = req.body;

    // 🔍 步骤1：检查后端到底收到了什么 (查看 Node 运行窗口)
    console.log('--- [后端接收检查] 原始 req.body.images:', images);

    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
        throw new AppError('酒店不存在', 404, 'HOTEL_NOT_FOUND');
    }

    if (hotel.merchantId.toString() !== req.user.userId) {
        throw new AppError('无权修改此酒店', 403, 'FORBIDDEN');
    }

    // 🔍 步骤2：组装更新对象，确保数值和数组类型严格正确
    const updateData = {};
    if (name) updateData.name = name;
    if (nameEn !== undefined) updateData.nameEn = nameEn;
    if (city) updateData.city = city;
    if (address) updateData.address = address;
    if (starRating !== undefined) updateData.starRating = Number(starRating);
    if (price !== undefined) updateData.price = Number(price);
    if (description !== undefined) updateData.description = description;
    if (tags) updateData.tags = tags;
    if (openingTime !== undefined) updateData.openingTime = openingTime;
    if (nearbyAttractions) updateData.nearbyAttractions = nearbyAttractions;
    if (nearbyTransport) updateData.nearbyTransport = nearbyTransport;
    if (nearbyMalls) updateData.nearbyMalls = nearbyMalls;
    if (location) updateData.location = location;
    
    // 🔴 强制更新：直接覆盖图片数组
    if (images && Array.isArray(images)) {
        updateData.images = images;
    }

    // 重置审核状态
    if (hotel.status === 1 || hotel.status === 2) {
        updateData.status = 0;
    }

    // 🔍 步骤3：使用 findByIdAndUpdate 进行“暴力”原子更新
    // 使用 { new: true } 返回更新后的结果
    const updatedHotel = await Hotel.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
    );

    // 🔍 步骤4：打印数据库真实持久化后的结果
    console.log('--- [数据库保存后] images 数组内容:', updatedHotel.images);

    res.json(updatedHotel);
}));

// 管理员：审核酒店 (PUT /api/hotels/:id/audit)
router.put('/:id/audit', authMiddleware, hotelValidators.audit, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new AppError('权限不足', 403, 'FORBIDDEN');
    }

    const { status, rejectReason } = req.body;
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
        throw new AppError('酒店不存在', 404, 'HOTEL_NOT_FOUND');
    }

    hotel.status = status;
    if (status === 2) {
        hotel.rejectReason = rejectReason || '未说明原因';
    } else {
        hotel.rejectReason = ''; 
    }

    await hotel.save();
    res.json(hotel);
}));

// 酒店上下线操作 (PUT /api/hotels/:id/status)
router.put('/:id/status', authMiddleware, hotelValidators.status, asyncHandler(async (req, res) => {
    const { status } = req.body;

    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
        throw new AppError('酒店不存在', 404, 'HOTEL_NOT_FOUND');
    }

    const isOwner = hotel.merchantId.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
        throw new AppError('无权操作', 403, 'FORBIDDEN');
    }

    if (status === 3) {
        hotel.status = 3; 
    } else if (status === 1) {
        hotel.status = 1;
    } else {
        throw new AppError('非法状态操作', 400, 'INVALID_STATUS');
    }

    await hotel.save();
    res.json({ msg: '操作成功', status: hotel.status });
}));

module.exports = router;