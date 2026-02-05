const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// 定义日志存储路径 (在 server/logs 下)
const logDirectory = path.join(__dirname, '../logs');

// 定义日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // 记录错误堆栈
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
);

// 创建 Logger 实例
const logger = winston.createLogger({
    format: logFormat,
    transports: [
        // 普通日志：每天轮转，保留 14 天
        new winston.transports.DailyRotateFile({
            filename: path.join(logDirectory, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info'
        }),
        // 错误日志：单独存一份，方便快速查看报错
        new winston.transports.DailyRotateFile({
            filename: path.join(logDirectory, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error'
        })
    ]
});

// 如果不是生产环境，也打印到控制台，方便调试
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(), // 控制台显示颜色
            winston.format.simple()
        )
    }));
}

// 创建一个 stream 对象，供 morgan 使用 (把 HTTP 请求日志导入 winston)
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

module.exports = logger;