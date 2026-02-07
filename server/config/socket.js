// Socket.IO 服务配置
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;
// 用户ID到socket映射
const userSockets = new Map();

/**
 * 初始化 Socket.IO 服务
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // 连接认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('认证失败：缺少token'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('认证失败：token无效'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 用户连接: ${socket.userId}`);

    // 将用户加入到自己的房间
    socket.join(`user_${socket.userId}`);
    userSockets.set(socket.userId, socket.id);

    // 监听加入聊天室
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
      console.log(`📝 用户 ${socket.userId} 加入会话: ${conversationId}`);
    });

    // 监听离开聊天室
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`🔌 用户断开: ${socket.userId}`);
      userSockets.delete(socket.userId);
    });
  });

  console.log('✅ Socket.IO 服务已初始化');
  return io;
}

/**
 * 获取 Socket.IO 实例
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO 未初始化');
  }
  return io;
}

/**
 * 向特定用户发送消息
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

/**
 * 向特定会话发送消息
 */
function emitToConversation(conversationId, event, data) {
  if (io) {
    io.to(`conv_${conversationId}`).emit(event, data);
  }
}

/**
 * 发送新消息通知
 */
function notifyNewMessage(conversationId, message, receiverId) {
  // 发送到会话房间
  emitToConversation(conversationId, 'new_message', message);
  // 发送未读消息通知给接收者
  emitToUser(receiverId, 'unread_update', { conversationId });
}

/**
 * 发送新订单通知给商户
 */
function notifyNewOrder(merchantId, order) {
  emitToUser(merchantId, 'new_order', order);
}

/**
 * 发送订单状态变更通知给用户
 */
function notifyOrderStatusChange(userId, order) {
  emitToUser(userId, 'order_status_change', order);
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToConversation,
  notifyNewMessage,
  notifyNewOrder,
  notifyOrderStatusChange
};
