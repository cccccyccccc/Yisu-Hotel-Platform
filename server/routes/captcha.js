// 滑块验证码路由
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Jimp = require('jimp');

const JWT_SECRET = process.env.JWT_SECRET;

// 内存存储验证码数据 (生产环境应使用 Redis)
const captchaStore = new Map();
const CAPTCHA_EXPIRY = 5 * 60 * 1000; // 5 分钟过期
const PIECE_SIZE = 44;
const IMAGE_WIDTH = 310;
const IMAGE_HEIGHT = 155;
const TOLERANCE = 5; // 允许误差 (像素)

// 定期清理过期验证码
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore.entries()) {
    if (now - val.timestamp > CAPTCHA_EXPIRY) {
      captchaStore.delete(key);
    }
  }
}, 60 * 1000);
cleanupTimer.unref(); // 不阻止进程退出 (测试环境)

/**
 * 生成渐变背景 + 噪点图片
 */
async function createBackground() {
  const image = new Jimp(IMAGE_WIDTH, IMAGE_HEIGHT);

  // 随机渐变色
  const hueStart = Math.random() * 360;
  for (let x = 0; x < IMAGE_WIDTH; x++) {
    for (let y = 0; y < IMAGE_HEIGHT; y++) {
      const hue = (hueStart + (x / IMAGE_WIDTH) * 60) % 360;
      const sat = 40 + (y / IMAGE_HEIGHT) * 30;
      const lum = 55 + Math.sin((x + y) * 0.05) * 15;
      const { r, g, b } = hslToRgb(hue, sat, lum);
      // 添加噪点
      const noise = Math.floor(Math.random() * 20) - 10;
      image.setPixelColor(
        Jimp.rgbaToInt(
          clamp(r + noise),
          clamp(g + noise),
          clamp(b + noise),
          255
        ),
        x, y
      );
    }
  }

  // 画一些随机色块增加辨识度
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(Math.random() * IMAGE_WIDTH);
    const cy = Math.floor(Math.random() * IMAGE_HEIGHT);
    const size = 20 + Math.floor(Math.random() * 40);
    const cr = Math.floor(Math.random() * 200) + 55;
    const cg = Math.floor(Math.random() * 200) + 55;
    const cb = Math.floor(Math.random() * 200) + 55;
    for (let dx = -size; dx < size; dx++) {
      for (let dy = -size; dy < size; dy++) {
        if (dx * dx + dy * dy < size * size) {
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < IMAGE_WIDTH && py >= 0 && py < IMAGE_HEIGHT) {
            const alpha = Math.max(0, 80 - Math.floor(Math.sqrt(dx * dx + dy * dy) * 2));
            const existing = Jimp.intToRGBA(image.getPixelColor(px, py));
            const nr = Math.floor(existing.r * (1 - alpha / 255) + cr * (alpha / 255));
            const ng = Math.floor(existing.g * (1 - alpha / 255) + cg * (alpha / 255));
            const nb = Math.floor(existing.b * (1 - alpha / 255) + cb * (alpha / 255));
            image.setPixelColor(Jimp.rgbaToInt(nr, ng, nb, 255), px, py);
          }
        }
      }
    }
  }

  return image;
}

/**
 * 从背景中切出拼图块并在背景上留下凹槽
 */
function cutPuzzlePiece(bgImage, x, y) {
  const piece = new Jimp(PIECE_SIZE, PIECE_SIZE, 0x00000000); // 透明背景

  for (let px = 0; px < PIECE_SIZE; px++) {
    for (let py = 0; py < PIECE_SIZE; py++) {
      // 圆角矩形 + 凸起形状
      if (isInPuzzleShape(px, py, PIECE_SIZE)) {
        // 复制像素到拼图块
        const srcX = x + px;
        const srcY = y + py;
        if (srcX < IMAGE_WIDTH && srcY < IMAGE_HEIGHT) {
          piece.setPixelColor(bgImage.getPixelColor(srcX, srcY), px, py);
        }

        // 背景上留下半透明阴影
        if (srcX < IMAGE_WIDTH && srcY < IMAGE_HEIGHT) {
          const orig = Jimp.intToRGBA(bgImage.getPixelColor(srcX, srcY));
          bgImage.setPixelColor(
            Jimp.rgbaToInt(
              Math.floor(orig.r * 0.3),
              Math.floor(orig.g * 0.3),
              Math.floor(orig.b * 0.3),
              255
            ),
            srcX, srcY
          );
        }
      }
    }
  }

  // 给拼图块添加边框效果
  for (let px = 0; px < PIECE_SIZE; px++) {
    for (let py = 0; py < PIECE_SIZE; py++) {
      if (isOnPuzzleBorder(px, py, PIECE_SIZE)) {
        const existing = Jimp.intToRGBA(piece.getPixelColor(px, py));
        if (existing.a > 0) {
          piece.setPixelColor(
            Jimp.rgbaToInt(
              Math.min(255, existing.r + 60),
              Math.min(255, existing.g + 60),
              Math.min(255, existing.b + 60),
              255
            ),
            px, py
          );
        }
      }
    }
  }

  return piece;
}

/**
 * 拼图形状判定（带凸起的矩形）
 */
function isInPuzzleShape(px, py, size) {
  const r = 6; // 圆角半径
  const bump = 8; // 凸起半径

  // 基础矩形 (带圆角)
  const inRect =
    px >= r && px < size - r && py >= 0 && py < size ||
    px >= 0 && px < size && py >= r && py < size - r ||
    dist(px, py, r, r) < r ||
    dist(px, py, size - r, r) < r ||
    dist(px, py, r, size - r) < r ||
    dist(px, py, size - r, size - r) < r;

  // 右侧凸起
  const bumpCx = size;
  const bumpCy = size / 2;
  const inBump = dist(px, py, bumpCx, bumpCy) < bump;

  // 顶部凸起
  const bumpTx = size / 2;
  const bumpTy = 0;
  const inTopBump = dist(px, py, bumpTx, bumpTy) < bump;

  return inRect || inBump || inTopBump;
}

/**
 * 拼图边框判定
 */
function isOnPuzzleBorder(px, py, size) {
  if (!isInPuzzleShape(px, py, size)) return false;
  // 检查相邻像素是否在形状外
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    if (!isInPuzzleShape(px + dx, py + dy, size)) return true;
  }
  return false;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.floor(v)));
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.floor((r + m) * 255),
    g: Math.floor((g + m) * 255),
    b: Math.floor((b + m) * 255),
  };
}

// ===== 路由 =====

// 生成验证码
router.get('/generate', async (req, res) => {
  try {
    const bgImage = await createBackground();

    // 随机位置（确保拼图块在画布内）
    const x = PIECE_SIZE + Math.floor(Math.random() * (IMAGE_WIDTH - PIECE_SIZE * 3));
    const y = 10 + Math.floor(Math.random() * (IMAGE_HEIGHT - PIECE_SIZE - 20));

    const piece = cutPuzzlePiece(bgImage, x, y);

    // 转为 base64
    const bgBase64 = await bgImage.getBase64Async(Jimp.MIME_PNG);
    const pieceBase64 = await piece.getBase64Async(Jimp.MIME_PNG);

    // 生成 captchaId
    const captchaId = crypto.randomBytes(16).toString('hex');
    captchaStore.set(captchaId, { x, timestamp: Date.now() });

    res.json({
      captchaId,
      bgImage: bgBase64,
      pieceImage: pieceBase64,
      y,
    });
  } catch (err) {
    console.error('验证码生成失败:', err);
    res.status(500).json({ msg: '验证码生成失败' });
  }
});

// 验证验证码
router.post('/verify', (req, res) => {
  const { captchaId, x } = req.body;

  if (!captchaId || x === undefined) {
    return res.status(400).json({ success: false, msg: '参数缺失' });
  }

  const stored = captchaStore.get(captchaId);
  if (!stored) {
    return res.status(400).json({ success: false, msg: '验证码已过期，请重新获取' });
  }

  // 一次性使用
  captchaStore.delete(captchaId);

  // 检查是否过期
  if (Date.now() - stored.timestamp > CAPTCHA_EXPIRY) {
    return res.json({ success: false, msg: '验证码已过期' });
  }

  // 验证位置
  if (Math.abs(x - stored.x) <= TOLERANCE) {
    // 签发一次性验证 token (5分钟有效)
    const captchaToken = jwt.sign(
      { captchaVerified: true, ts: Date.now() },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.json({ success: true, captchaToken });
  }

  return res.json({ success: false, msg: '验证失败，请重试' });
});

module.exports = router;
