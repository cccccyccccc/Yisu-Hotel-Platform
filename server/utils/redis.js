const { createClient } = require('redis');
const logger = require('./logger');

// Windows 本地默认地址是 localhost:6379
const client = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

client.on('error', (err) => {
    // 记录错误日志，但不中断进程
    logger.error(`Redis Client Error: ${err.message}`);
});

client.on('connect', () => {
    logger.info('✅ Redis 连接成功');
});

// 立即启动连接
(async () => {
    try {
        await client.connect();
    } catch (err) {
        logger.error(`❌ Redis 初始化连接失败: ${err.message}`);
    }
})();

module.exports = client;