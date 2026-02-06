import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Rate, List, Avatar, Empty,
  Statistic, Tag, message, Button, Space
} from 'antd';
import {
  CommentOutlined, ArrowLeftOutlined, PieChartOutlined,
  LineChartOutlined, BarChartOutlined
} from '@ant-design/icons';
import { Pie, Line, Column } from '@ant-design/charts';
import { useNavigate, useParams } from 'react-router-dom';
import { getHotelDetail } from '@/api/hotels';
import { getHotelReviews } from '@/api/reviews';
import styles from './HotelDetail.module.css';
import dayjs from 'dayjs';

interface Review {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  hotelId: string;
  rating: number;
  content: string;
  createdAt: string;
}

interface Hotel {
  _id: string;
  name: string;
  nameEn?: string;
  city: string;
  address: string;
  starRating: number;
  score?: number;
  price: number;
  status: number;
  images?: string[];
  tags?: string[];
}

const HotelDetail: React.FC = () => {
  const { hotelId } = useParams<{ hotelId: string }>();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [hotelRes, reviewsRes] = await Promise.all([
        getHotelDetail(hotelId),
        getHotelReviews(hotelId)
      ]);
      setHotel(hotelRes.data);
      setReviews(reviewsRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '暂无';

  // 饼图数据 - 评分占比
  const pieData = [5, 4, 3, 2, 1].map(star => ({
    type: `${star}星`,
    value: reviews.filter(r => r.rating === star).length,
  })).filter(item => item.value > 0);

  // 柱状图数据 - 各星级总数
  const columnData = [5, 4, 3, 2, 1].map(star => ({
    star: `${star}星`,
    count: reviews.filter(r => r.rating === star).length,
  }));

  // 折线图数据 - 按日期统计评价趋势（最近30天）
  const getLineData = () => {
    const last30Days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      last30Days.push(dayjs().subtract(i, 'day').format('MM-DD'));
    }

    const data: { date: string; star: string; count: number }[] = [];
    [5, 4, 3, 2, 1].forEach(star => {
      last30Days.forEach(date => {
        const count = reviews.filter(r =>
          dayjs(r.createdAt).format('MM-DD') === date && r.rating === star
        ).length;
        data.push({
          date,
          star: `${star}星`,
          count,
        });
      });
    });
    return data;
  };

  const lineData = getLineData();

  // 图表配置
  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.6,
    label: {
      text: (d: { type: string; value: number }) => `${d.type}: ${d.value}`,
      position: 'outside' as const,
    },
    legend: {
      position: 'bottom' as const,
    },
    style: {
      stroke: '#fff',
      lineWidth: 2,
    },
  };

  const columnConfig = {
    data: columnData,
    xField: 'star',
    yField: 'count',
    colorField: 'star',
    label: {
      text: (d: { count: number }) => d.count.toString(),
      position: 'inside' as const,
    },
    legend: false as const,
    style: {
      radiusTopLeft: 4,
      radiusTopRight: 4,
    },
  };

  const lineConfig = {
    data: lineData,
    xField: 'date',
    yField: 'count',
    colorField: 'star',
    smooth: true,
    point: {
      size: 3,
    },
    legend: {
      position: 'top' as const,
    },
    axis: {
      x: {
        label: {
          autoRotate: true,
        },
      },
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/merchant/hotels')}
        >
          返回
        </Button>
        <h2 className={styles.title}>{hotel?.name || '酒店详情'}</h2>
      </div>

      <Row gutter={24}>
        <Col span={8}>
          <Card title="酒店信息" loading={loading}>
            {hotel && (
              <>
                <p><strong>名称：</strong>{hotel.name}</p>
                {hotel.nameEn && <p><strong>英文名：</strong>{hotel.nameEn}</p>}
                <p><strong>城市：</strong>{hotel.city}</p>
                <p><strong>地址：</strong>{hotel.address}</p>
                <p><strong>星级：</strong>{'⭐'.repeat(hotel.starRating)}</p>
                <p><strong>起步价：</strong>¥{hotel.price}</p>
                {hotel.tags && hotel.tags.length > 0 && (
                  <p>
                    <strong>标签：</strong>
                    {hotel.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
                  </p>
                )}
              </>
            )}
          </Card>
        </Col>

        <Col span={16}>
          <Card
            title={
              <Space>
                <CommentOutlined />
                用户评价 ({reviews.length} 条)
              </Space>
            }
            loading={loading}
            extra={
              <Space>
                <Statistic
                  title="综合评分"
                  value={avgRating}
                  suffix="/ 5"
                  valueStyle={{ color: '#faad14', fontSize: 24 }}
                />
              </Space>
            }
          >
            {/* 统计图表区域 */}
            {reviews.length > 0 && (
              <div className={styles.chartsSection}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card
                      size="small"
                      title={<><PieChartOutlined /> 评分占比</>}
                      className={styles.chartCard}
                    >
                      <div className={styles.chartContainer}>
                        <Pie {...pieConfig} />
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      title={<><BarChartOutlined /> 评分统计</>}
                      className={styles.chartCard}
                    >
                      <div className={styles.chartContainer}>
                        <Column {...columnConfig} />
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      title={<><LineChartOutlined /> 评价趋势</>}
                      className={styles.chartCard}
                    >
                      <div className={styles.chartContainer}>
                        <Line {...lineConfig} />
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            )}

            {reviews.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={reviews}
                pagination={{ pageSize: 5 }}
                renderItem={review => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar src={review.userId?.avatar}>
                          {review.userId?.username?.charAt(0).toUpperCase()}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <span>{review.userId?.username || '匿名用户'}</span>
                          <Rate disabled value={review.rating} style={{ fontSize: 14 }} />
                          <span className={styles.reviewDate}>
                            {dayjs(review.createdAt).format('YYYY-MM-DD')}
                          </span>
                        </Space>
                      }
                      description={review.content}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无评价" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HotelDetail;
