const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Order = require('../models/Order');
const Hotel = require('../models/Hotel');
const authMiddleware = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// 获取会话列表 (GET /api/messages/conversations)
router.get('/conversations', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 获取该用户参与的所有消息
  const messages = await Message.aggregate([
    {
      $match: {
        $or: [
          { senderId: userObjectId },
          { receiverId: userObjectId }
        ]
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiverId', userObjectId] },
                  { $eq: ['$read', false] }
                ]
              },
              1, 0
            ]
          }
        }
      }
    },
    { $sort: { 'lastMessage.createdAt': -1 } }
  ]);

  // 填充对方用户信息
  const conversations = await Promise.all(messages.map(async (conv) => {
    const lastMsg = conv.lastMessage;
    const otherId = lastMsg.senderId.toString() === userId
      ? lastMsg.receiverId
      : lastMsg.senderId;

    const otherUser = await User.findById(otherId).select('username avatar role');

    return {
      conversationId: conv._id,
      otherUser,
      lastMessage: lastMsg,
      unreadCount: conv.unreadCount
    };
  }));

  res.json(conversations);
}));

// 商户：获取可联系的用户列表（有订单关系的用户）
router.get('/contacts', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  if (role === 'merchant') {
    // 商户：获取在自己酒店下过订单的用户
    const myHotels = await Hotel.find({ merchantId: userId }).select('_id');
    const hotelIds = myHotels.map(h => h._id);

    const orders = await Order.find({ hotelId: { $in: hotelIds } })
      .populate('userId', 'username avatar')
      .populate('hotelId', 'name');

    // 去重用户
    const userMap = new Map();
    orders.forEach(order => {
      if (order.userId && !userMap.has(order.userId._id.toString())) {
        userMap.set(order.userId._id.toString(), {
          user: order.userId,
          hotel: order.hotelId,
          lastOrderDate: order.createdAt
        });
      }
    });

    res.json(Array.from(userMap.values()));
  } else {
    // 用户：获取自己下过订单的酒店的商户
    const orders = await Order.find({ userId })
      .populate({
        path: 'hotelId',
        select: 'name merchantId',
        populate: { path: 'merchantId', select: 'username avatar' }
      });

    // 去重商户
    const merchantMap = new Map();
    orders.forEach(order => {
      if (order.hotelId && order.hotelId.merchantId) {
        const merchant = order.hotelId.merchantId;
        if (!merchantMap.has(merchant._id.toString())) {
          merchantMap.set(merchant._id.toString(), {
            user: merchant,
            hotel: { name: order.hotelId.name, _id: order.hotelId._id },
            lastOrderDate: order.createdAt
          });
        }
      }
    });

    res.json(Array.from(merchantMap.values()));
  }
}));

// 获取与某用户的聊天记录 (GET /api/messages/:userId)
router.get('/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const myId = req.user.userId;
  const otherId = req.params.userId;

  const conversationId = Message.generateConversationId(myId, otherId);

  const messages = await Message.find({ conversationId })
    .populate('senderId', 'username avatar')
    .populate('receiverId', 'username avatar')
    .sort({ createdAt: 1 })
    .limit(100);

  // 标记消息为已读
  await Message.updateMany(
    { conversationId, receiverId: myId, read: false },
    { $set: { read: true } }
  );

  res.json(messages);
}));

// 发送消息 (POST /api/messages)
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { receiverId, content, type = 'text' } = req.body;
  const senderId = req.user.userId;
  const senderRole = req.user.role;

  if (!receiverId || !content) {
    throw new AppError('接收者和消息内容不能为空', 400);
  }

  // 验证接收者存在
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new AppError('接收者不存在', 404);
  }

  // 商户发消息给用户：验证是否有订单关系
  if (senderRole === 'merchant' && receiver.role === 'user') {
    const myHotels = await Hotel.find({ merchantId: senderId }).select('_id');
    const hotelIds = myHotels.map(h => h._id);

    const hasOrder = await Order.findOne({
      hotelId: { $in: hotelIds },
      userId: receiverId
    });

    if (!hasOrder) {
      throw new AppError('只能联系在您酒店有订单的用户', 403);
    }
  }

  const conversationId = Message.generateConversationId(senderId, receiverId);

  const message = await Message.create({
    conversationId,
    senderId,
    receiverId,
    content: content.trim(),
    type
  });

  const populatedMessage = await Message.findById(message._id)
    .populate('senderId', 'username avatar')
    .populate('receiverId', 'username avatar');

  // 实时推送消息
  try {
    const { notifyNewMessage } = require('../config/socket');
    notifyNewMessage(conversationId, populatedMessage, receiverId);
  } catch (e) {
    // Socket.IO 未初始化时忽略
  }

  res.status(201).json(populatedMessage);
}));

// 获取未读消息数 (GET /api/messages/unread/count)
router.get('/unread/count', authMiddleware, asyncHandler(async (req, res) => {
  const count = await Message.countDocuments({
    receiverId: req.user.userId,
    read: false
  });
  res.json({ count });
}));

module.exports = router;
