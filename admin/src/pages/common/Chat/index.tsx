import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card, List, Avatar, Input, Button, message, Empty, Badge, Spin, Modal, Tag
} from 'antd';
import {
  SendOutlined, MessageOutlined, UserOutlined, PlusOutlined
} from '@ant-design/icons';
import { getConversations, getMessages, sendMessage, getContacts } from '@/api/messages';
import type { Conversation, Message, Contact } from '@/api/messages';
import { useUserStore } from '@/stores';
import { useChatSocket, useSocket } from '@/hooks/useSocket';
import styles from './Chat.module.css';
import dayjs from 'dayjs';

const Chat: React.FC = () => {
  const { user } = useUserStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation['otherUser'] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 新建会话相关
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const fetchConversations = async () => {
    try {
      const res = await getConversations();
      setConversations(res.data);
    } catch {
      console.error('获取会话列表失败');
    }
  };

  const fetchMessages = async (userId: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getMessages(userId);
      setMessages(res.data);
      setTimeout(() => scrollToBottom(), 100);
    } catch {
      if (showLoading) message.error('获取消息失败');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await getContacts();
      setContacts(res.data);
    } catch {
      message.error('获取联系人失败');
    } finally {
      setContactsLoading(false);
    }
  };

  // 初始化 Socket 连接
  useSocket();

  // 生成会话ID
  const conversationId = selectedUser && user
    ? [user._id, selectedUser._id].sort().join('_')
    : null;

  // 实时消息回调
  const handleNewMessage = useCallback((newMsg: Message) => {
    setMessages(prev => {
      // 避免重复添加
      if (prev.some(m => m._id === newMsg._id)) return prev;
      return [...prev, newMsg];
    });
    setTimeout(() => scrollToBottom(), 100);
    fetchConversations();
  }, []);

  // 使用 Socket.IO 实时监听
  useChatSocket(conversationId, handleNewMessage);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !selectedUser) return;

    setSending(true);
    try {
      await sendMessage(selectedUser._id, inputValue.trim());
      setInputValue('');
      fetchMessages(selectedUser._id, false);
      fetchConversations();
    } catch {
      message.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedUser(conv.otherUser);
  };

  const handleOpenContactModal = () => {
    setContactModalVisible(true);
    fetchContacts();
  };

  const handleSelectContact = (contact: Contact) => {
    // 直接开始聊天
    setSelectedUser({
      _id: contact.user._id,
      username: contact.user.username,
      avatar: contact.user.avatar,
      role: user?.role === 'merchant' ? 'user' : 'merchant'
    });
    setContactModalVisible(false);
  };

  const formatTime = (dateStr: string) => {
    const date = dayjs(dateStr);
    const now = dayjs();
    if (date.isSame(now, 'day')) {
      return date.format('HH:mm');
    }
    if (date.isSame(now, 'year')) {
      return date.format('MM-DD HH:mm');
    }
    return date.format('YYYY-MM-DD');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <MessageOutlined /> 消息中心
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenContactModal}
        >
          发起聊天
        </Button>
      </div>

      <div className={styles.chatLayout}>
        {/* 会话列表 */}
        <Card className={styles.conversationList} bodyStyle={{ padding: 0 }}>
          <div className={styles.listHeader}>会话列表</div>
          {conversations.length === 0 ? (
            <Empty description="暂无会话" style={{ padding: 40 }} />
          ) : (
            <List
              dataSource={conversations}
              renderItem={(conv) => (
                <List.Item
                  className={`${styles.convItem} ${selectedUser?._id === conv.otherUser?._id ? styles.active : ''}`}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge count={conv.unreadCount} size="small">
                        <Avatar src={conv.otherUser?.avatar}>
                          {conv.otherUser?.username?.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    }
                    title={
                      <div className={styles.convTitle}>
                        <span>{conv.otherUser?.username}</span>
                        <span className={styles.convTime}>
                          {formatTime(conv.lastMessage?.createdAt)}
                        </span>
                      </div>
                    }
                    description={
                      <div className={styles.convPreview}>
                        {conv.lastMessage?.content?.slice(0, 20)}
                        {conv.lastMessage?.content?.length > 20 && '...'}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* 聊天窗口 */}
        <Card className={styles.chatWindow} bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {selectedUser ? (
            <>
              <div className={styles.chatHeader}>
                <Avatar src={selectedUser.avatar} size="small">
                  {selectedUser.username?.charAt(0).toUpperCase()}
                </Avatar>
                <span className={styles.chatTitle}>{selectedUser.username}</span>
                <Tag color={selectedUser.role === 'merchant' ? 'blue' : 'green'}>
                  {selectedUser.role === 'merchant' ? '商户' : '用户'}
                </Tag>
              </div>

              <div className={styles.messageArea}>
                {loading ? (
                  <div className={styles.loadingArea}><Spin /></div>
                ) : messages.length === 0 ? (
                  <Empty description="暂无消息，发送第一条消息吧" style={{ marginTop: 100 }} />
                ) : (
                  messages.map((msg) => {
                    // 兼容 senderId 可能是字符串或对象
                    const senderId = typeof msg.senderId === 'string'
                      ? msg.senderId
                      : msg.senderId?._id;
                    const isSent = senderId === user?._id;
                    const senderName = typeof msg.senderId === 'string'
                      ? ''
                      : msg.senderId?.username;
                    const senderAvatar = typeof msg.senderId === 'string'
                      ? undefined
                      : msg.senderId?.avatar;

                    return (
                      <div
                        key={msg._id}
                        className={`${styles.messageItem} ${isSent ? styles.sent : styles.received}`}
                      >
                        <Avatar
                          src={senderAvatar}
                          size="small"
                          className={styles.msgAvatar}
                        >
                          {senderName?.charAt(0).toUpperCase()}
                        </Avatar>
                        <div className={styles.msgWrapper}>
                          <div className={styles.msgBubble}>
                            <div className={styles.msgContent}>{msg.content}</div>
                          </div>
                          <div className={styles.msgTime}>{formatTime(msg.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.inputArea}>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onPressEnter={handleSend}
                  placeholder="输入消息..."
                  className={styles.inputBox}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  className={styles.sendBtn}
                >
                  发送
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.noChat}>
              <UserOutlined style={{ fontSize: 48, color: '#cbd5e1' }} />
              <p>选择一个会话开始聊天</p>
            </div>
          )}
        </Card>
      </div>

      {/* 选择联系人弹窗 */}
      <Modal
        title={user?.role === 'merchant' ? '选择客户' : '选择商户'}
        open={contactModalVisible}
        onCancel={() => setContactModalVisible(false)}
        footer={null}
        width={500}
      >
        {contactsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : contacts.length === 0 ? (
          <Empty
            description={
              user?.role === 'merchant'
                ? '暂无客户，只能联系在您酒店有订单的用户'
                : '暂无可联系的商户'
            }
          />
        ) : (
          <List
            dataSource={contacts}
            renderItem={(contact) => (
              <List.Item
                className={styles.contactItem}
                onClick={() => handleSelectContact(contact)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar src={contact.user.avatar}>
                      {contact.user.username?.charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  title={contact.user.username}
                  description={
                    <div>
                      <Tag color="blue">{contact.hotel.name}</Tag>
                      <span className={styles.orderDate}>
                        订单时间: {dayjs(contact.lastOrderDate).format('YYYY-MM-DD')}
                      </span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default Chat;
