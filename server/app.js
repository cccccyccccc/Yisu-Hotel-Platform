// 主程序部分
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const setupSwagger = require('./swagger');

const app = express();
const PORT = process.env.PORT || 5000;

// 允许跨域访问并且连接数据库
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yisu-hotel')
        .then(() => console.log('✅ MongoDB 数据库连接成功!'))
        .catch(err => console.error('❌ MongoDB 连接失败:', err));
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

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);

setupSwagger(app); // 开启swagger

// 后端服务开启
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 服务正在运行: http://localhost:${PORT}`);
    });
}

module.exports = app;