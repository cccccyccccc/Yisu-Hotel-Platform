import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Avatar, Rate, Tag, Empty, Spin, message } from 'antd';
import {
  HomeOutlined, ShoppingCartOutlined, CommentOutlined,
  DollarOutlined, RiseOutlined, StarOutlined
} from '@ant-design/icons';
import { getMerchantStats } from '@/api/merchant';
import type { MerchantStats } from '@/api/merchant';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MerchantStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await getMerchantStats();
      setStats(res.data);
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>数据统计</h1>
        <p className={styles.subtitle}>查看您的酒店经营数据概览</p>
      </div>

      {/* 统计卡片区 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className={`${styles.statCard} ${styles.hotelCard}`}>
            <Statistic
              title="酒店总数"
              value={stats?.hotels.total || 0}
              prefix={<HomeOutlined />}
              suffix={
                <span className={styles.subStat}>
                  已发布 {stats?.hotels.published || 0}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={`${styles.statCard} ${styles.orderCard}`}>
            <Statistic
              title="本月新增订单"
              value={stats?.orders.monthly || 0}
              prefix={<ShoppingCartOutlined />}
              suffix={
                <span className={styles.subStat}>
                  总计 {stats?.orders.total || 0}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={`${styles.statCard} ${styles.reviewCard}`}>
            <Statistic
              title="本月新增评价"
              value={stats?.reviews.monthly || 0}
              prefix={<CommentOutlined />}
              suffix={
                <span className={styles.subStat}>
                  总计 {stats?.reviews.total || 0}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={`${styles.statCard} ${styles.revenueCard}`}>
            <Statistic
              title="本月收入"
              value={stats?.orders.monthlyRevenue || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      {/* 第二行统计 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card className={styles.infoCard}>
            <div className={styles.infoContent}>
              <RiseOutlined className={styles.infoIcon} />
              <div>
                <div className={styles.infoLabel}>总收入</div>
                <div className={styles.infoValue}>¥{(stats?.orders.totalRevenue || 0).toLocaleString()}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className={styles.infoCard}>
            <div className={styles.infoContent}>
              <StarOutlined className={styles.infoIcon} style={{ color: '#f59e0b' }} />
              <div>
                <div className={styles.infoLabel}>平均评分</div>
                <div className={styles.infoValue}>
                  {stats?.reviews.averageRating || '-'}
                  <Rate disabled value={stats?.reviews.averageRating || 0} allowHalf style={{ fontSize: 14, marginLeft: 8 }} />
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className={styles.infoCard}>
            <div className={styles.infoContent}>
              <HomeOutlined className={styles.infoIcon} style={{ color: '#10b981' }} />
              <div>
                <div className={styles.infoLabel}>待审核酒店</div>
                <div className={styles.infoValue}>{stats?.hotels.pending || 0} 家</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最新评价列表 */}
      <Card
        className={styles.reviewsCard}
        title={
          <div className={styles.reviewsHeader}>
            <CommentOutlined />
            <span>最新评价</span>
            <Tag color="blue">{stats?.reviews.monthly || 0} 条本月新增</Tag>
          </div>
        }
        style={{ marginTop: 20 }}
      >
        {stats?.latestReviews && stats.latestReviews.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={stats.latestReviews}
            renderItem={(item) => (
              <List.Item className={styles.reviewItem}>
                <List.Item.Meta
                  avatar={
                    <Avatar src={item.user?.avatar} size={48}>
                      {item.user?.username?.charAt(0) || 'U'}
                    </Avatar>
                  }
                  title={
                    <div className={styles.reviewTitle}>
                      <span className={styles.reviewUser}>{item.user?.username || '匿名用户'}</span>
                      <Rate disabled value={item.rating} style={{ fontSize: 12 }} />
                      <span className={styles.reviewDate}>{formatDate(item.createdAt)}</span>
                    </div>
                  }
                  description={
                    <div>
                      <div className={styles.reviewHotel}>
                        <Tag color="cyan">{item.hotel?.name || '未知酒店'}</Tag>
                      </div>
                      <div className={styles.reviewContent}>{item.content}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无评价" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
