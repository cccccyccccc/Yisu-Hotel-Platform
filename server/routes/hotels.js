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
        const safeKeyword = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`); // NOSONAR
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

// 发布新酒店 (POST /api/hotels)
router.post('/', authMiddleware, hotelValidators.create, asyncHandler(async (req, res) => {
    if (req.user.role !== 'merchant') {
        throw new AppError('只有商户权限才能发布酒店', 403, 'FORBIDDEN');
    }

    const { name, nameEn, city, address, starRating, price, description, tags, openingTime, location, nearbyAttractions, nearbyTransport, nearbyMalls } = req.body;
    const safeName = String(name);
    const existingHotel = await Hotel.findOne({ name: safeName });
    if (existingHotel) {
        throw new AppError('该酒店名称已存在', 400, 'HOTEL_EXISTS');
    }

    const newHotel = new Hotel({
        merchantId: req.user.userId,
        name, nameEn, city, address, starRating, price, description, tags, openingTime,
        location, nearbyAttractions, nearbyTransport, nearbyMalls,
        status: 0
    });

    const hotel = await newHotel.save();
    res.json(hotel);
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
    // 关联查询商户名，方便管理员知道是谁发布的
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
            Hotel.countDocuments(countQuery) // 使用干净的 countQuery
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
router.get('/:id', cache(600), asyncHandler(async (req, res) => {
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
    // 验证器已检查 ID 格式

    const { name, nameEn, city, address, starRating, price, description, tags, openingTime, nearbyAttractions, nearbyTransport, nearbyMalls } = req.body;

    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
        throw new AppError('酒店不存在', 404, 'HOTEL_NOT_FOUND');
    }

    // 权限校验
    if (hotel.merchantId.toString() !== req.user.userId) {
        throw new AppError('无权修改此酒店', 403, 'FORBIDDEN');
    }

    // 更新字段
    if (name) hotel.name = name;
    if (nameEn) hotel.nameEn = nameEn;
    if (city) hotel.city = city;
    if (address) hotel.address = address;
    if (starRating) hotel.starRating = starRating;
    if (price !== undefined) hotel.price = price;
    if (description) hotel.description = description;
    if (tags) hotel.tags = tags;
    if (openingTime) hotel.openingTime = openingTime;
    // 附近信息字段
    if (nearbyAttractions) hotel.nearbyAttractions = nearbyAttractions;
    if (nearbyTransport) hotel.nearbyTransport = nearbyTransport;
    if (nearbyMalls) hotel.nearbyMalls = nearbyMalls;

    // 如果原本是“已发布”或“不通过”，修改后重置为“待审核”
    if (hotel.status === 1 || hotel.status === 2) {
        hotel.status = 0;
    }
    await hotel.save();
    res.json(hotel);
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
        hotel.rejectReason = ''; // 通过则清空原因
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

    // 上下线逻辑
    if (status === 3) {
        hotel.status = 3; // 下线
    } else if (status === 1) {
        // 只有曾经审核通过的(status=1)或者只是被下线的(status=3)才能恢复
        // 这里简单处理：允许恢复为1
        hotel.status = 1;
    } else {
        // 理论上 validator 已经拦截，但双重保险
        throw new AppError('非法状态操作', 400, 'INVALID_STATUS');
    }

    await hotel.save();
    res.json({ msg: '操作成功', status: hotel.status });
}));

module.exports = router;