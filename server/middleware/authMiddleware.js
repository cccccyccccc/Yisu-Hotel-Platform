// 登录认证中间件
const jwt = require('jsonwebtoken');

// 密钥
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function(req, res, next) {
    // 从请求头获取 Token
    // 前端通常会发：Authorization: Bearer <token>
    const tokenHeader = req.header('Authorization');
    // 如果没有 Token，直接拒绝
    if (!tokenHeader) {
        return res.status(401).json({ msg: '无访问权限，请先登录' });
    }
    try {
        // 去掉 "Bearer " 前缀拿到纯 Token 字符串
        const token = tokenHeader.replace('Bearer ', '');
        // 验证 Token
        const decoded = jwt.verify(token, JWT_SECRET);
        // 把解析出的用户信息存入 req.user，后续路由就能用了
        req.user = decoded;
        next(); // 放行，进入下一个环节
    } catch (err) {
        res.status(401).json({ msg: 'Token 无效或已过期' });
    }
};