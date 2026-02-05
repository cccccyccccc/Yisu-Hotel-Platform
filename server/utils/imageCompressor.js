// 图片压缩工具
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * 图片压缩配置
 */
const CONFIG = {
  // JPEG 压缩质量 (1-100)
  jpegQuality: 80,
  // PNG 压缩质量 (1-100)
  pngQuality: 80,
  // WebP 压缩质量 (1-100)
  webpQuality: 80,
  // 最大宽度 (超过则缩小)
  maxWidth: 1920,
  // 最大高度 (超过则缩小)
  maxHeight: 1080,
  // 是否生成 WebP 格式
  generateWebp: true
};

/**
 * 压缩单张图片
 * @param {string} inputPath - 原图路径
 * @param {object} options - 可选配置
 * @returns {Promise<object>} - { originalPath, compressedPath, webpPath, savedBytes }
 */
async function compressImage(inputPath, options = {}) {
  const config = { ...CONFIG, ...options };

  try {
    // 获取原始文件信息
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;

    // 解析文件名
    const ext = path.extname(inputPath).toLowerCase();
    const basename = path.basename(inputPath, ext);
    const dir = path.dirname(inputPath);

    // 创建 sharp 实例
    let image = sharp(inputPath);
    const metadata = await image.metadata();

    // 如果图片超过最大尺寸，进行缩放
    if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
      image = image.resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // 根据格式进行压缩
    let compressedPath = inputPath;
    if (['.jpg', '.jpeg'].includes(ext)) {
      image = image.jpeg({ quality: config.jpegQuality });
    } else if (ext === '.png') {
      image = image.png({ quality: config.pngQuality });
    } else if (ext === '.webp') {
      image = image.webp({ quality: config.webpQuality });
    }

    // 输出压缩后的文件（覆盖原文件）
    const outputBuffer = await image.toBuffer();
    fs.writeFileSync(inputPath, outputBuffer);

    // 计算节省的空间
    const compressedSize = outputBuffer.length;
    const savedBytes = originalSize - compressedSize;
    const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

    const result = {
      originalPath: inputPath,
      compressedPath: inputPath,
      originalSize: originalSize,
      compressedSize: compressedSize,
      savedBytes: savedBytes,
      savedPercent: `${savedPercent}%`
    };

    // 可选：生成 WebP 格式
    if (config.generateWebp && ext !== '.webp') {
      const webpPath = path.join(dir, `${basename}.webp`);
      await sharp(inputPath)
        .webp({ quality: config.webpQuality })
        .toFile(webpPath);

      result.webpPath = webpPath;
      result.webpSize = fs.statSync(webpPath).size;
    }

    logger.info(`图片压缩完成: ${inputPath}, 节省 ${savedPercent}%`);
    return result;

  } catch (err) {
    logger.error(`图片压缩失败: ${inputPath}`, err);
    throw err;
  }
}

/**
 * 批量压缩图片
 * @param {string[]} inputPaths - 图片路径数组
 * @param {object} options - 可选配置
 * @returns {Promise<object[]>} - 压缩结果数组
 */
async function compressImages(inputPaths, options = {}) {
  const results = await Promise.all(
    inputPaths.map(p => compressImage(p, options).catch(err => ({
      originalPath: p,
      error: err.message
    })))
  );
  return results;
}

/**
 * 生成缩略图
 * @param {string} inputPath - 原图路径
 * @param {number} width - 缩略图宽度
 * @param {number} height - 缩略图高度
 * @returns {Promise<string>} - 缩略图路径
 */
async function generateThumbnail(inputPath, width = 200, height = 200) {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const thumbPath = path.join(dir, `${basename}_thumb${ext}`);

  await sharp(inputPath)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    })
    .toFile(thumbPath);

  logger.info(`缩略图生成完成: ${thumbPath}`);
  return thumbPath;
}

module.exports = {
  compressImage,
  compressImages,
  generateThumbnail,
  CONFIG
};
