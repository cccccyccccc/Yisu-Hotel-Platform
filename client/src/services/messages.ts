import request from './request'

// 消息类型
export type MessageType = 'text' | 'image'

// 消息接口
export interface Message {
  _id: string
  conversationId: string
  senderId: {
    _id: string
    username: string
    avatar?: string
  }
  receiverId: {
    _id: string
    username: string
    avatar?: string
  }
  content: string
  type: MessageType
  read: boolean
  createdAt: string
}

// 会话接口
export interface Conversation {
  conversationId: string
  otherUser: {
    _id: string
    username: string
    avatar?: string
    role: string
  }
  lastMessage: Message
  unreadCount: number
}

// 可联系用户接口
export interface Contact {
  user: {
    _id: string
    username: string
    avatar?: string
  }
  hotel: {
    _id: string
    name: string
  }
  lastOrderDate: string
}

// 获取会话列表
export function getConversations(): Promise<Conversation[]> {
  return request<Conversation[]>({
    url: '/messages/conversations',
    method: 'GET'
  })
}

// 获取可联系用户列表
export function getContacts(): Promise<Contact[]> {
  return request<Contact[]>({
    url: '/messages/contacts',
    method: 'GET'
  })
}

// 获取未读消息数
export function getUnreadCount(): Promise<{ count: number }> {
  return request<{ count: number }>({
    url: '/messages/unread/count',
    method: 'GET'
  })
}

// 获取与某用户的聊天记录
export function getMessages(userId: string): Promise<Message[]> {
  return request<Message[]>({
    url: `/messages/${userId}`,
    method: 'GET'
  })
}

// 发送消息
export function sendMessage(
  receiverId: string,
  content: string,
  type: MessageType = 'text'
): Promise<Message> {
  return request<Message>({
    url: '/messages',
    method: 'POST',
    data: { receiverId, content, type }
  })
}

