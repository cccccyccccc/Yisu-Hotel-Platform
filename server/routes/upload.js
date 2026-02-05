const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('node:path');

// 配置存储策略
const storage = multer.diskStorage({
    // 存储位置
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); // 存储路径
    },
    // 重命名文件 (防止文件名冲突)
    filename: function (req, file, cb) {
        // 生成规则: 时间戳 + 随机数 + 原始后缀
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname); // 获取图片后缀
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// 过滤文件类型 (只允许图片)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件！'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});


// 上传单张图片接口 (POST /api/upload)
// 'file' 是前端上传时的字段名 (formData key)
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: '请选择要上传的文件' });
        }

        // 返回给前端的相对路径
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({
            msg: '上传成功',
            url: fileUrl  // 前端拿到这个 url 后，把它塞进 Hotel 或 Room 的 images 数组里
        });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

module.exports = router;