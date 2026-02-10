// Socket.IO 客户端 Hook
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-admin';
import { useUserStore } from '@/stores';

// Socket.IO 服务器地址
const SOCKET_URL = 'http://localhost:5000';

// 全局 socket 实例
let socket: Socket | null = null;

/**
 * Socket.IO 连接 Hook
 */
export const useSocket = () => {
  const { token, isAuthenticated } = useUserStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      // 未登录时断开连接
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    // 已有连接则复用
    if (socket?.connected) {
      socketRef.current = socket;
      return;
    }

    // 创建新连接
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('🔌 Socket.IO 已连接');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO 断开:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('🔌 Socket.IO 连接错误:', err.message);
    });

    socketRef.current = socket;

    return () => {
      // 组件卸载时不断开全局连接
    };
  }, [isAuthenticated, token]);

  return socketRef.current;
};

/**
 * 聊天消息监听 Hook
 */
export const useChatSocket = <T = unknown>(
  conversationId: string | null,
  onNewMessage: (message: T) => void
) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !conversationId) return;

    // 加入会话房间
    socket.emit('join_conversation', conversationId);

    // 监听新消息
    const handleNewMessage = (message: T) => {
      onNewMessage(message);
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, conversationId, onNewMessage]);
};

/**
 * 通知监听 Hook
 */
export const useNotificationSocket = (callbacks: {
  onUnreadUpdate?: (data: { conversationId: string }) => void;
  onNewOrder?: (order: unknown) => void;
  onOrderStatusChange?: (order: unknown) => void;
}) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    if (callbacks.onUnreadUpdate) {
      socket.on('unread_update', callbacks.onUnreadUpdate);
    }
    if (callbacks.onNewOrder) {
      socket.on('new_order', callbacks.onNewOrder);
    }
    if (callbacks.onOrderStatusChange) {
      socket.on('order_status_change', callbacks.onOrderStatusChange);
    }

    return () => {
      socket.off('unread_update');
      socket.off('new_order');
      socket.off('order_status_change');
    };
  }, [socket, callbacks]);
};

/**
 * 获取全局 Socket 实例
 */
export const getSocket = () => socket;
