const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { compressImage } = require('../utils/imageCompressor');

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

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 上传单张图片接口 (POST /api/upload)
// 'file' 是前端上传时的字段名 (formData key)
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: '请选择要上传的文件' });
        }

        // 在路由处理器中检查文件类型
        if (!req.file.mimetype.startsWith('image/')) {
            // 删除已上传的非图片文件
            const uploadedPath = path.join('public/uploads/', req.file.filename);
            if (fs.existsSync(uploadedPath)) {
                fs.unlinkSync(uploadedPath);
            }
            return res.status(400).json({ msg: '只允许上传图片文件' });
        }

        const filePath = path.join('public/uploads/', req.file.filename);

        // 自动压缩图片
        let compressionResult = null;
        try {
            compressionResult = await compressImage(filePath, {
                generateWebp: false // 可选：是否生成 WebP 版本
            });
            logger.info(`图片压缩完成，节省 ${compressionResult.savedPercent}`);
        } catch (compressErr) {
            // 压缩失败不影响上传，仅记录日志
            logger.warn(`图片压缩失败: ${compressErr.message}`);
        }

        // 返回给前端的相对路径
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({
            msg: '上传成功',
            url: fileUrl,
            compression: compressionResult ? {
                originalSize: compressionResult.originalSize,
                compressedSize: compressionResult.compressedSize,
                savedPercent: compressionResult.savedPercent
            } : null
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ msg: err.message });
    }
});

module.exports = router;