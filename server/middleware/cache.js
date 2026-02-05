const redisClient = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * 缓存中间件
 * @param {number} duration 缓存时间（秒）
 */
const cache = (duration = 300) => {
    return async (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }

        if (process.env.NODE_ENV === 'test') {
            return next();
        }

        const key = `cache:${req.originalUrl || req.url}`;

        try {
            const cachedData = await redisClient.get(key);

            if (cachedData) {
                return res.json(JSON.parse(cachedData));
            }

            const originalJson = res.json;

            res.json = (body) => {
                // 恢复原方法，防止影响后续逻辑
                res.json = originalJson;

                // 只有请求成功 (200) 才缓存
                if (res.statusCode === 200) {
                    // 异步写入 Redis，不阻塞响应
                    redisClient.set(key, JSON.stringify(body), {
                        EX: duration // 过期时间
                    }).catch(err => logger.error(`Redis Set Error: ${err.message}`));
                }

                // 执行原本的响应
                return originalJson.call(res, body);
            };

            next();

        } catch (err) {
            logger.error(`Redis Middleware Error: ${err.message}`);
            next();
        }
    };
};

module.exports = cache;