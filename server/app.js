// 主程序部分
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('node:path');
const setupSwagger = require('./swagger');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');

app.use(helmet({
    crossOriginResourcePolicy: false, // 允许跨域加载静态资源 (图片)
}));

// 允许跨域访问并且连接数据库
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? false : '*', // 简单起见，生产环境需按需配置
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: '请求过于频繁，请稍后再试' }
});
// 应用限流到所有 /api 路由
app.use('/api', limiter);

app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const connectDB = async () => {
    try {
        const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yisu-hotel-platform';
        await mongoose.connect(dbUri);
        console.log('✅ MongoDB 连接成功!');
    } catch (err) {
        console.error('❌ MongoDB 连接失败:', err.message);
    }
};

// 在非测试环境下调用
if (process.env.NODE_ENV !== 'test') {
    void connectDB();
}

app.get('/', (req, res) => {
    res.send('易宿酒店平台后端服务已启动！');
});

// 路由注册部分
const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotels');
const roomRoutes = require('./routes/rooms');
const uploadRoutes = require('./routes/upload');
const orderRoutes = require('./routes/orders');
const favoriteRoutes = require('./routes/favorites');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const bannerRoutes = require('./routes/banners');
const healthRoutes = require('./routes/health');

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/health', healthRoutes);

setupSwagger(app); // 开启swagger

// 导入错误处理中间件
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// 404 处理 - 必须在所有路由之后
app.use(notFoundHandler);

// 全局错误处理 - 必须在最后
app.use(errorHandler);

// 后端服务开启
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 服务正在运行: http://localhost:${PORT}`);
    });
}

module.exports = app;