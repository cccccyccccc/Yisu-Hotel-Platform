const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');

// 发布新酒店 (POST /api/hotels)
router.post('/', authMiddleware, async (req, res) => {
    try {
        // 权限检查：只有商户(merchant)才能发布
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ msg: '只有商户权限才能发布酒店' });
        }

        const { name, address, starRating, price, description, tags } = req.body;

        // 名称查重
        const existingHotel = await Hotel.findOne({ name: name });
        if (existingHotel) {
            return res.status(400).json({ msg: '该酒店名称已存在，请勿重复发布' });
        }

        // 创建新酒店
        const newHotel = new Hotel({
            merchantId: req.user.userId, // 从 Token 里自动获取当前商户 ID
            name,
            address,
            starRating,
            price,
            description,
            tags,
            status: 0 // 默认为待审核
        });

        const hotel = await newHotel.save();
        res.json(hotel);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});


// 获取我的酒店列表 (GET /api/hotels/my)
router.get('/my', authMiddleware, async (req, res) => {
    try {
        // 根据当前登录用户的 ID 查找酒店
        const hotels = await Hotel.find({ merchantId: req.user.userId })
            .sort({ createdAt: -1 }); // 按时间倒序
        res.json(hotels);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

// 修改酒店信息 (PUT /api/hotels/:id)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, address, price, status } = req.body;

        // 只能改自己的酒店
        let hotel = await Hotel.findById(req.params.id);
        if (!hotel) return res.status(404).json({ msg: '酒店不存在' });

        // 验证所有权
        if (hotel.merchantId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: '无权修改此酒店' });
        }

        // 更新字段
        hotel.name = name || hotel.name;
        hotel.address = address || hotel.address;
        hotel.price = price || hotel.price;

        // 如果修改了关键信息，建议重置状态为待审核 (这里简化处理，暂不重置)

        await hotel.save();
        res.json(hotel);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '服务器错误' });
    }
});

module.exports = router;