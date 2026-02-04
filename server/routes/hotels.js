const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const Order = require('../models/Order');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');

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
        const {
            city, keyword, starRating, minPrice, maxPrice,
            sortType, page = 1, limit = 10,
            userLat, userLng,
            tags,
            checkInDate, checkOutDate // 获取日期参数
        } = req.query;

        let baseQuery = { status: 1 };

        // 日期可用性筛选逻辑
        if (checkInDate && checkOutDate) {
            const start = new Date(String(checkInDate));
            const end = new Date(String(checkOutDate));

            // 找出该时间段内所有"已占用"库存的订单
            // 逻辑：订单的入住时间段与用户查询的时间段有重叠
            // 重叠条件：(订单入住 < 查询离店) && (订单离店 > 查询入住)
            const overlappingOrders = await Order.find({
                status: { $in: ['paid', 'completed', 'pending'] }, // 排除 cancelled
                checkInDate: { $lt: end },
                checkOutDate: { $gt: start }
            }).select('roomTypeId quantity');

            // 统计每个房型已被占用的数量
            const bookedMap = {}; // { roomTypeId: count }
            overlappingOrders.forEach(order => {
                const rId = order.roomTypeId.toString();
                bookedMap[rId] = (bookedMap[rId] || 0) + order.quantity;
            });

            // 找出所有房型，判断剩余库存
            // 注意：这里为了简化逻辑，查出了所有房型。
            // 生产环境中，建议配合 city 等条件先缩小 RoomType 的查询范围
            const allRoomTypes = await RoomType.find({}).select('hotelId stock _id');

            // 筛选出"有房"的酒店ID集合
            const availableHotelIds = new Set();

            allRoomTypes.forEach(room => {
                const bookedCount = bookedMap[room._id.toString()] || 0;
                // 如果 总库存 > 已预订量，说明该房型有房
                if (room.stock > bookedCount) {
                    availableHotelIds.add(room.hotelId.toString());
                }
            });

            // 将有房的酒店ID加入 baseQuery
            if (availableHotelIds.size === 0) {
                baseQuery._id = null;
            } else {
                baseQuery._id = { $in: Array.from(availableHotelIds) };
            }
        }

        if (city) baseQuery.city = String(city);
        if (starRating) baseQuery.starRating = Number(starRating);
        if (minPrice || maxPrice) {
            baseQuery.price = {};
            if (minPrice) baseQuery.price.$gte = Number(minPrice);
            if (maxPrice) baseQuery.price.$lte = Number(maxPrice);
        }

        if (keyword) {
            const safeKeyword = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            baseQuery.$or = [
                { name: { $regex: safeKeyword, $options: 'i' } },
                { address: { $regex: safeKeyword, $options: 'i' } }
            ];
        }

        if (tags) {
            const tagsArray = String(tags).split(',').map(t => t.trim()).filter(t => t);
            if (tagsArray.length > 0) {
                baseQuery.tags = { $all: tagsArray };
            }
        }

        let findQuery = { ...baseQuery };
        let countQuery = { ...baseQuery };
        let sort = {};

        if (sortType === 'distance' && userLat && userLng) {
            findQuery.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(userLng), parseFloat(userLat)]
                    }
                }
            };
            sort = {};
        } else {
            switch (sortType) {
                case 'price_asc':  sort = { price: 1 }; break;
                case 'price_desc': sort = { price: -1 }; break;
                case 'score_desc': sort = { score: -1 }; break;
                default:           sort = { createdAt: -1 };
            }
        }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, parseInt(limit));
        const skip = (pageNum - 1) * limitNum;

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
        console.error(err);
        if (err.message && err.message.includes('index')) {
            return res.status(500).json({ msg: 'Database Index Missing' });
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