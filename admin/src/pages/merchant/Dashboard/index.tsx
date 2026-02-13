import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Avatar, Rate, Tag, Empty, Spin, message, Progress, Tooltip, Button } from 'antd';
import {
  HomeOutlined, ShoppingCartOutlined, CommentOutlined,
  DollarOutlined, StarOutlined,
  ArrowUpOutlined, ArrowDownOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Line } from '@ant-design/charts';
import { getMerchantStats } from '@/api/merchant';
import type { MerchantStats } from '@/api/merchant';
import styles from './Dashboard.module.css';

// 扩展的统计数据类型
interface ExtendedMerchantStats extends MerchantStats {
  orders: MerchantStats['orders'] & { lastMonthRevenue?: number };
  reviews: MerchantStats['reviews'] & { ratingDistribution?: Record<number, number> };
  revenueHistory?: { date: string; revenue: number }[];
  dailyOccupancy?: { date: string; count: number }[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExtendedMerchantStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await getMerchantStats();
      setStats(res.data);
    } catch {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 计算环比增长率
  const getGrowthRate = (): number => {
    const current = stats?.orders.monthlyRevenue || 0;
    const last = stats?.orders.lastMonthRevenue || 0;
    if (last === 0) return current > 0 ? 100 : 0;
    return parseFloat(((current - last) / last * 100).toFixed(1));
  };

  // 获取评分分布百分比
  const getRatingPercent = (rating: number) => {
    const dist = stats?.reviews.ratingDistribution;
    if (!dist) return 0;
    const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0);
    if (total === 0) return 0;
    return Math.round((dist[rating] || 0) / total * 100);
  };

  // 图表配置
  const lineConfig = {
    data: stats?.revenueHistory || [],
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    height: 200,
    point: { size: 3, shape: 'circle' },
    color: '#3b82f6',
    xAxis: {
      label: {
        formatter: (v: string) => v.slice(5), // 只显示MM-DD
      },
      tickCount: 7,
    },
    yAxis: {
      label: {
        formatter: (v: number) => `¥${v}`,
      },
    },
    tooltip: {
      formatter: (datum: { date: string; revenue: number }) => ({
        name: '收入',
        value: `¥${datum.revenue.toLocaleString()}`,
      }),
    },
  };

  // 生成日历热力图
  const renderHeatmap = () => {
    const data = stats?.dailyOccupancy || [];
    if (data.length === 0) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

    // 取最近90天数据
    const recent = data.slice(-90);
    const maxCount = Math.max(...recent.map((d: { count: number }) => d.count), 1);

    return (
      <div className={styles.heatmapContainer}>
        <div className={styles.heatmapGrid}>
          {recent.map((item: { date: string; count: number }, index: number) => {
            const intensity = item.count / maxCount;
            const bgColor = item.count === 0
              ? '#ebedf0'
              : `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`;
            return (
              <Tooltip
                key={index}
                title={`${item.date}: ${item.count}间房预订`}
              >
                <div
                  className={styles.heatmapCell}
                  style={{ backgroundColor: bgColor }}
                />
              </Tooltip>
            );
          })}
        </div>
        <div className={styles.heatmapLegend}>
          <span>少</span>
          <div className={styles.legendBar} />
          <span>多</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  const growthRate = getGrowthRate();

  return (
    <div className={styles.container}>

      {/* 统计卡片区 - 可点击 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={`${styles.statCard} ${styles.hotelCard}`}
            onClick={() => navigate('/merchant/hotels')}
            hoverable
          >
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
          <Card
            className={`${styles.statCard} ${styles.orderCard}`}
            onClick={() => navigate('/merchant/orders?month=current')}
            hoverable
          >
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
          <Card
            className={`${styles.statCard} ${styles.reviewCard}`}
            onClick={() => navigate('/merchant/reviews?month=current')}
            hoverable
          >
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
              title={
                <span>
                  本月收入
                  {growthRate !== 0 && (
                    <Tag
                      color={growthRate > 0 ? 'green' : 'red'}
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      {growthRate > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {Math.abs(growthRate)}%
                    </Tag>
                  )}
                </span>
              }
              value={stats?.orders.monthlyRevenue || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      {/* 第二行：收入趋势图 + 评分分布 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <Card title="近30天收入趋势" className={styles.chartCard}>
            {stats?.revenueHistory && stats.revenueHistory.length > 0 ? (
              <Line {...lineConfig} />
            ) : (
              <Empty description="暂无收入数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="平均评分" className={styles.chartCard}>
            <div className={styles.ratingContent}>
              <div className={styles.ratingScore}>
                <StarOutlined className={styles.ratingIcon} />
                <span className={styles.ratingNumber}>{stats?.reviews.averageRating || '-'}</span>
                <Rate disabled value={stats?.reviews.averageRating || 0} allowHalf style={{ fontSize: 20, marginLeft: 12 }} />
              </div>
              {/* 评分分布 */}
              <div className={styles.ratingDistLarge}>
                {[5, 4, 3, 2, 1].map(r => (
                  <div key={r} className={styles.ratingRowLarge}>
                    <span className={styles.ratingLabel}>{r}星</span>
                    <Progress
                      percent={getRatingPercent(r)}
                      size="small"
                      showInfo={false}
                      strokeColor={r >= 4 ? '#52c41a' : r >= 3 ? '#faad14' : '#ff4d4f'}
                      style={{ flex: 1, margin: '0 12px' }}
                    />
                    <span className={styles.ratingPercent}>{getRatingPercent(r)}%</span>
                    <span className={styles.ratingCount}>({stats?.reviews.ratingDistribution?.[r] || 0}条)</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第三行：日历热力图 + 最新评价（精简版） */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className={styles.cardTitle}>
                <CalendarOutlined />
                <span>入住热力图（近90天）</span>
              </div>
            }
            className={styles.heatmapCard}
          >
            {renderHeatmap()}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className={styles.reviewsCard}
            title={
              <div className={styles.reviewsHeader}>
                <CommentOutlined />
                <span>最新评价</span>
                <Tag color="blue">{stats?.reviews.monthly || 0} 条本月新增</Tag>
              </div>
            }
          >
            {stats?.latestReviews && stats.latestReviews.length > 0 ? (
              <>
                <List
                  itemLayout="horizontal"
                  dataSource={stats.latestReviews.slice(0, 3)}
                  renderItem={(item) => (
                    <List.Item className={styles.reviewItemCompact}>
                      <List.Item.Meta
                        avatar={
                          <Avatar src={item.user?.avatar} size={40}>
                            {item.user?.username?.charAt(0) || 'U'}
                          </Avatar>
                        }
                        title={
                          <div className={styles.reviewTitle}>
                            <span className={styles.reviewUser}>{item.user?.username || '匿名用户'}</span>
                            <Rate disabled value={item.rating} style={{ fontSize: 12 }} />
                          </div>
                        }
                        description={
                          <div className={styles.reviewContentCompact}>{item.content}</div>
                        }
                      />
                    </List.Item>
                  )}
                />
                <div className={styles.viewAllBtn}>
                  <Button
                    type="link"
                    onClick={() => navigate('/merchant/reviews')}
                    style={{ padding: 0 }}
                  >
                    查看全部评价 →
                  </Button>
                </div>
              </>
            ) : (
              <Empty description="暂无评价" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
