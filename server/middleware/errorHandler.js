// 统一错误处理中间件
const logger = require('../utils/logger');

/**
 * 自定义应用错误类
 * 用于在业务逻辑中抛出带状态码的错误
 */
class AppError extends Error {
  constructor(message, statusCode, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // 标记为可操作错误（非系统崩溃）

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 异步路由包装器
 * 自动捕获异步函数中的错误并传递给 next()
 * 使用方式: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 路由未找到处理
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`接口不存在: ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

/**
 * 全局错误处理中间件
 * 统一格式化错误响应
 */
const errorHandler = (err, req, res, next) => {
  // 设置默认值
  err.statusCode = err.statusCode || 500;
  err.message = err.message || '服务器内部错误';

  // 记录错误日志（非测试环境）
  if (process.env.NODE_ENV !== 'test') {
    logger.error({
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: req.requestId
    });
  }

  // Mongoose 验证错误
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    err.statusCode = 400;
    err.message = messages.join(', ');
    err.code = 'VALIDATION_ERROR';
  }

  // Mongoose 重复键错误
  if (err.code === 11000) {
    err.statusCode = 400;
    err.message = '数据已存在';
    err.code = 'DUPLICATE_ERROR';
  }

  // Mongoose CastError (无效的 ObjectId)
  if (err.name === 'CastError') {
    err.statusCode = 400;
    err.message = `无效的 ${err.path}: ${err.value}`;
    err.code = 'CAST_ERROR';
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    err.statusCode = 401;
    err.message = '无效的认证令牌';
    err.code = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.message = '认证令牌已过期';
    err.code = 'TOKEN_EXPIRED';
  }

  // 响应格式
  const response = {
    success: false,
    msg: err.message,
    code: err.code || 'ERROR'
  };

  // 开发环境返回堆栈信息
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(err.statusCode).json(response);
};

module.exports = {
  AppError,
  asyncHandler,
  notFoundHandler,
  errorHandler
};
