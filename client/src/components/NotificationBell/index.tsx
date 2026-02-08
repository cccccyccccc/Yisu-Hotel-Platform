import { useState, useEffect, useCallback } from 'react';
import { Badge, Popover, List, Typography, Button, Tabs, Empty, Spin, Tag, message } from 'antd';
import { BellOutlined, MessageOutlined, NotificationOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAnnouncements, getUnreadAnnouncementCount, markAnnouncementRead, getAnnouncementDetail } from '@/api/announcements';
import { getUnreadMessageCount } from '@/api/messages';
import type { AnnouncementListItem, Announcement } from '@/api/announcements';
import dayjs from 'dayjs';
import styles from './NotificationBell.module.css';

const { Text } = Typography;

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementListItem[]>([]);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 获取未读数量
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const [announcementRes, messageRes] = await Promise.all([
        getUnreadAnnouncementCount(),
        getUnreadMessageCount()
      ]);
      setUnreadAnnouncementCount(announcementRes.data.count);
      setUnreadMessageCount(messageRes.data.count);
    } catch (error) {
      // 静默失败
    }
  }, []);

  // 获取公告列表
  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await getAnnouncements();
      setAnnouncements(res.data);
    } catch (error) {
      // 静默失败
    } finally {
      setLoading(false);
    }
  };

  // 定期轮询未读数
  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000); // 30秒轮询
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  // 打开时加载公告
  useEffect(() => {
    if (open) {
      fetchAnnouncements();
    }
  }, [open]);

  // 查看公告详情并标记已读
  const handleViewAnnouncement = async (item: AnnouncementListItem) => {
    setDetailLoading(true);
    try {
      const res = await getAnnouncementDetail(item._id);
      setSelectedAnnouncement(res.data);
      await markAnnouncementRead(item._id);
      fetchUnreadCounts(); // 刷新未读数
    } catch (error) {
      message.error('获取公告详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 跳转到消息中心
  const handleGoToMessages = () => {
    setOpen(false);
    navigate('/chat');
  };

  // 标记全部已读
  const handleMarkAllRead = async () => {
    try {
      await Promise.all(announcements.map(a => markAnnouncementRead(a._id)));
      message.success('已全部标记为已读');
      fetchUnreadCounts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const totalUnread = unreadAnnouncementCount + unreadMessageCount;

  const getTypeTag = (type: string) => {
    const colors: Record<string, string> = {
      info: 'blue',
      success: 'green',
      warning: 'orange'
    };
    const labels: Record<string, string> = {
      info: '通知',
      success: '成功',
      warning: '警告'
    };
    return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>;
  };

  const content = (
    <div className={styles.popoverContent}>
      <Tabs
        defaultActiveKey="announcements"
        items={[
          {
            key: 'announcements',
            label: (
              <span>
                <NotificationOutlined />
                公告 {unreadAnnouncementCount > 0 && <Badge count={unreadAnnouncementCount} size="small" />}
              </span>
            ),
            children: (
              <div className={styles.tabContent}>
                {selectedAnnouncement ? (
                  <div className={styles.announcementDetail}>
                    <Button type="link" onClick={() => setSelectedAnnouncement(null)} style={{ padding: 0 }}>
                      ← 返回列表
                    </Button>
                    <h3>{selectedAnnouncement.title}</h3>
                    <div className={styles.detailMeta}>
                      {getTypeTag(selectedAnnouncement.type)}
                      <Text type="secondary">{dayjs(selectedAnnouncement.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                    </div>
                    <div className={styles.detailContent}>{selectedAnnouncement.content}</div>
                  </div>
                ) : (
                  <>
                    {unreadAnnouncementCount > 0 && (
                      <div className={styles.actionBar}>
                        <Button size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
                          全部已读
                        </Button>
                      </div>
                    )}
                    <Spin spinning={loading || detailLoading}>
                      {announcements.length > 0 ? (
                        <List
                          size="small"
                          dataSource={announcements}
                          renderItem={(item) => (
                            <List.Item
                              className={styles.listItem}
                              onClick={() => handleViewAnnouncement(item)}
                            >
                              <div className={styles.itemContent}>
                                <div className={styles.itemTitle}>
                                  {getTypeTag(item.type)}
                                  <Text ellipsis style={{ flex: 1 }}>{item.title}</Text>
                                </div>
                                <Text type="secondary" className={styles.itemTime}>
                                  {dayjs(item.createdAt).format('MM-DD HH:mm')}
                                </Text>
                              </div>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="暂无公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Spin>
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'messages',
            label: (
              <span>
                <MessageOutlined />
                消息 {unreadMessageCount > 0 && <Badge count={unreadMessageCount} size="small" />}
              </span>
            ),
            children: (
              <div className={styles.tabContent}>
                <div className={styles.messagesHint}>
                  <MessageOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
                  <Text type="secondary" style={{ marginTop: 8 }}>
                    您有 {unreadMessageCount} 条未读消息
                  </Text>
                  <Button type="primary" onClick={handleGoToMessages} style={{ marginTop: 12 }}>
                    前往消息中心
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayClassName={styles.popover}
    >
      <Badge count={totalUnread} overflowCount={99} className={className}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          className={styles.bellButton}
        />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
