import request from './request';

// 消息类型
export interface Message {
  _id: string;
  conversationId: string;
  senderId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  receiverId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  type: 'text' | 'image';
  read: boolean;
  createdAt: string;
}

// 会话类型
export interface Conversation {
  conversationId: string;
  otherUser: {
    _id: string;
    username: string;
    avatar?: string;
    role: string;
  };
  lastMessage: Message;
  unreadCount: number;
}

// 获取会话列表
export const getConversations = () => {
  return request.get<Conversation[]>('/api/messages/conversations');
};

// 获取与某用户的聊天记录
export const getMessages = (userId: string) => {
  return request.get<Message[]>(`/api/messages/${userId}`);
};

// 发送消息
export const sendMessage = (receiverId: string, content: string, type: string = 'text') => {
  return request.post<Message>('/api/messages', { receiverId, content, type });
};

// 获取未读消息数
export const getUnreadCount = () => {
  return request.get<{ count: number }>('/api/messages/unread/count');
};

// 别名导出
export const getUnreadMessageCount = getUnreadCount;

// 可联系用户/商户类型
export interface Contact {
  user: {
    _id: string;
    username: string;
    avatar?: string;
  };
  hotel: {
    _id: string;
    name: string;
  };
  lastOrderDate: string;
}

// 获取可联系的用户/商户列表（基于订单关系）
export const getContacts = () => {
  return request.get<Contact[]>('/api/messages/contacts');
};

