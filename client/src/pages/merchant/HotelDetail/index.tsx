import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Rate, List, Avatar, Empty,
  Statistic, Tag, message, Button, Space
} from 'antd';
import {
  CommentOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
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

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    percent: reviews.length > 0
      ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100)
      : 0
  }));

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
            <Row gutter={24} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <div className={styles.ratingDistribution}>
                  {ratingDistribution.map(item => (
                    <div key={item.star} className={styles.ratingRow}>
                      <span>{item.star}星</span>
                      <div className={styles.ratingBar}>
                        <div
                          className={styles.ratingFill}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <span>{item.count}条</span>
                    </div>
                  ))}
                </div>
              </Col>
            </Row>

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
