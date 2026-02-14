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

const formatTime = (dateStr: string) => {
  const date = dayjs(dateStr);
  const now = dayjs();
  if (date.isSame(now, 'day')) return date.format('HH:mm');
  if (date.isSame(now, 'year')) return date.format('MM-DD HH:mm');
  return date.format('YYYY-MM-DD');
};

/** 单条消息 */
const MessageItem: React.FC<{ msg: Message; currentUserId?: string }> = ({ msg, currentUserId }) => {
  const senderId = typeof msg.senderId === 'string' ? msg.senderId : msg.senderId?._id;
  const isSent = senderId === currentUserId;
  const senderName = typeof msg.senderId === 'string' ? '' : msg.senderId?.username;
  const senderAvatar = typeof msg.senderId === 'string' ? undefined : msg.senderId?.avatar;

  return (
    <div className={`${styles.messageItem} ${isSent ? styles.sent : styles.received}`}>
      <Avatar src={senderAvatar} size="small" className={styles.msgAvatar}>
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
};

/** 消息列表区域 */
const MessageList: React.FC<{
  loading: boolean;
  messages: Message[];
  currentUserId?: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}> = ({ loading, messages, currentUserId, messagesEndRef }) => {
  if (loading) return <div className={styles.loadingArea}><Spin /></div>;
  if (messages.length === 0) return <Empty description="暂无消息，发送第一条消息吧" style={{ marginTop: 100 }} />;
  return (
    <>
      {messages.map((msg) => (
        <MessageItem key={msg._id} msg={msg} currentUserId={currentUserId} />
      ))}
      <div ref={messagesEndRef} />
    </>
  );
};

/** 联系人弹窗内容 */
const ContactList: React.FC<{
  loading: boolean;
  contacts: Contact[];
  role?: string;
  onSelect: (c: Contact) => void;
}> = ({ loading, contacts, role, onSelect }) => {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
  if (contacts.length === 0) {
    const desc = role === 'merchant' ? '暂无客户，只能联系在您酒店有订单的用户' : '暂无可联系的商户';
    return <Empty description={desc} />;
  }
  return (
    <List
      dataSource={contacts}
      renderItem={(contact) => (
        <List.Item className={styles.contactItem} onClick={() => onSelect(contact)}>
          <List.Item.Meta
            avatar={<Avatar src={contact.user.avatar}>{contact.user.username?.charAt(0).toUpperCase()}</Avatar>}
            title={contact.user.username}
            description={
              <div>
                <Tag color="blue">{contact.hotel.name}</Tag>
                <span className={styles.orderDate}>订单时间: {dayjs(contact.lastOrderDate).format('YYYY-MM-DD')}</span>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
};

const Chat: React.FC = () => {
  const { user } = useUserStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation['otherUser'] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useSocket();

  const conversationId = selectedUser && user
    ? [user._id, selectedUser._id].sort((a, b) => a.localeCompare(b)).join('_')
    : null;

  const handleNewMessage = useCallback((newMsg: Message) => {
    setMessages(prev => {
      if (prev.some(m => m._id === newMsg._id)) return prev;
      return [...prev, newMsg];
    });
    setTimeout(() => scrollToBottom(), 100);
    fetchConversations();
  }, []);

  useChatSocket(conversationId, handleNewMessage);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedUser) fetchMessages(selectedUser._id);
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

  const handleSelectContact = (contact: Contact) => {
    setSelectedUser({
      _id: contact.user._id,
      username: contact.user.username,
      avatar: contact.user.avatar,
      role: user?.role === 'merchant' ? 'user' : 'merchant'
    });
    setContactModalVisible(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}><MessageOutlined /> 消息中心</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setContactModalVisible(true); fetchContacts(); }}>发起聊天</Button>
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
                  onClick={() => setSelectedUser(conv.otherUser)}
                >
                  <List.Item.Meta
                    avatar={<Badge count={conv.unreadCount} size="small"><Avatar src={conv.otherUser?.avatar}>{conv.otherUser?.username?.charAt(0).toUpperCase()}</Avatar></Badge>}
                    title={<div className={styles.convTitle}><span>{conv.otherUser?.username}</span><span className={styles.convTime}>{formatTime(conv.lastMessage?.createdAt)}</span></div>}
                    description={<div className={styles.convPreview}>{conv.lastMessage?.content?.slice(0, 20)}{(conv.lastMessage?.content?.length ?? 0) > 20 && '...'}</div>}
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
                <Avatar src={selectedUser.avatar} size="small">{selectedUser.username?.charAt(0).toUpperCase()}</Avatar>
                <span className={styles.chatTitle}>{selectedUser.username}</span>
                <Tag color={selectedUser.role === 'merchant' ? 'blue' : 'green'}>{selectedUser.role === 'merchant' ? '商户' : '用户'}</Tag>
              </div>
              <div className={styles.messageArea}>
                <MessageList loading={loading} messages={messages} currentUserId={user?._id} messagesEndRef={messagesEndRef} />
              </div>
              <div className={styles.inputArea}>
                <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onPressEnter={handleSend} placeholder="输入消息..." className={styles.inputBox} />
                <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={sending} className={styles.sendBtn}>发送</Button>
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

      <Modal title={user?.role === 'merchant' ? '选择客户' : '选择商户'} open={contactModalVisible} onCancel={() => setContactModalVisible(false)} footer={null} width={500}>
        <ContactList loading={contactsLoading} contacts={contacts} role={user?.role} onSelect={handleSelectContact} />
      </Modal>
    </div>
  );
};

export default Chat;
