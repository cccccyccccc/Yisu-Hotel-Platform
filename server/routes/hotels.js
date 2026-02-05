const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');

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
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ msg: '只有商户权限才能发布酒店' });
        }

        const { name, nameEn, city, address, starRating, price, description, tags, openingTime, location } = req.body;
        const safeName = String(name);
        const existingHotel = await Hotel.findOne({ name: safeName });
        if (existingHotel) {
            return res.status(400).json({ msg: '该酒店名称已存在' });
        }

        const newHotel = new Hotel({
            merchantId: req.user.userId,
            name, nameEn, city, address, starRating, price, description, tags, openingTime,
            location,
            status: 0
        });

        const hotel = await newHotel.save();
        res.json(hotel);
    } catch (err) {
        console.error(err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 获取我的酒店列表 (GET /api/hotels/my)
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const hotels = await Hotel.find({ merchantId: req.user.userId })
            .sort({ createdAt: -1 });
        res.json(hotels);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 管理员：查看所有酒店 (GET /api/hotels/admin/list)
router.get('/admin/list', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ msg: '权限不足' });
        // 关联查询商户名，方便管理员知道是谁发布的
        const hotels = await Hotel.find()
            .populate('merchantId', 'username')
            .sort({ createdAt: -1 });

        res.json(hotels);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 首页搜索接口 (GET /api/hotels)
router.get('/', async (req, res) => {
    try {
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
        if (process.env.NODE_ENV !== 'test') console.error(err.message);
        if (err.message?.includes('index')) {
            return res.status(500).json({ msg: 'LBS Index Missing' });
        }
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 获取单个酒店详情 (GET /api/hotels/:id)
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID format' });
        }

        const hotel = await Hotel.findById(req.params.id);
        if (!hotel) return res.status(404).json({ msg: 'Not Found' });
        res.json(hotel);
    } catch (err) {
        // 如果 ID 格式不对，也会进这里，返回 404 比 Server Error 更友好
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Hotel not found' });
        res.status(500).json({ msg: 'Server Error' });
    }
});



// 商户修改酒店信息 (PUT /api/hotels/:id)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid ID format' });
        }

        const { name, nameEn, city, address, starRating, price, description, tags, openingTime } = req.body;

        const hotel = await Hotel.findById(req.params.id);
        if (!hotel) return res.status(404).json({ msg: '酒店不存在' });

        // 权限校验
        if (hotel.merchantId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: '无权修改此酒店' });
        }

        // 更新字段
        if (name) hotel.name = name;
        if (nameEn) hotel.nameEn = nameEn;
        if (city) hotel.city = city;
        if (address) hotel.address = address;
        if (starRating) hotel.starRating = starRating;
        if (price) hotel.price = price;
        if (description) hotel.description = description;
        if (tags) hotel.tags = tags;
        if (openingTime) hotel.openingTime = openingTime;

        // 如果原本是“已发布”或“不通过”，修改后重置为“待审核”
        if (hotel.status === 1 || hotel.status === 2) {
            hotel.status = 0;
        }
        await hotel.save();
        res.json(hotel);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// 管理员：审核酒店 (PUT /api/hotels/:id/audit)
router.put('/:id/audit', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ msg: '权限不足' });

        const { status, rejectReason } = req.body;
        const hotel = await Hotel.findById(req.params.id);

        hotel.status = status;
        if (status === 2) {
            hotel.rejectReason = rejectReason || '未说明原因';
        } else {
            hotel.rejectReason = ''; // 通过则清空原因
        }

        await hotel.save();
        res.json(hotel);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});



// 酒店上下线操作 (PUT /api/hotels/:id/status)
router.put('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;

        const hotel = await Hotel.findById(req.params.id);
        if (!hotel) return res.status(404).json({ msg: '酒店不存在' });

        const isOwner = hotel.merchantId.toString() === req.user.userId;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ msg: '无权操作' });
        }

        // 上下线逻辑
        if (status === 3) {
            hotel.status = 3; // 下线
        } else if (status === 1) {
            // 只有曾经审核通过的(status=1)或者只是被下线的(status=3)才能恢复
            // 这里简单处理：允许恢复为1
            hotel.status = 1;
        } else {
            return res.status(400).json({ msg: '非法状态操作' });
        }

        await hotel.save();
        res.json({ msg: '操作成功', status: hotel.status });

    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;