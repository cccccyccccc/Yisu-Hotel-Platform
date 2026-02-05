// 健康检查路由
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 健康检查接口 (GET /api/health)
 * 用于监控系统状态，负载均衡器健康检查
 */
router.get('/', async (req, res) => {
  try {
    // 检查数据库连接状态
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    // 获取内存使用情况
    const memUsage = process.memoryUsage();

    const healthInfo = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()) + 's',
      database: {
        status: dbStatus[dbState] || 'unknown',
        name: mongoose.connection.name || 'N/A'
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
      },
      node: {
        version: process.version,
        env: process.env.NODE_ENV || 'development'
      }
    };

    // 如果数据库未连接，返回 503
    if (dbState !== 1) {
      return res.status(503).json(healthInfo);
    }

    res.json(healthInfo);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
