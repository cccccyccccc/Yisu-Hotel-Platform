import { useEffect, useState } from 'react';
import {
  Table, Card, Tag, message, Space, Button, Select, Rate, Avatar,
  Statistic, Row, Col
} from 'antd';
import {
  ReloadOutlined, CommentOutlined, StarOutlined
} from '@ant-design/icons';
import { getMerchantReviews } from '@/api/reviews';
import type { MerchantReview } from '@/api/reviews';
import type { ColumnsType } from 'antd/es/table';
import styles from './ReviewList.module.css';
import dayjs from 'dayjs';

const ReviewList: React.FC = () => {
  const [reviews, setReviews] = useState<MerchantReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await getMerchantReviews();
      setReviews(res.data);
    } catch (error) {
      message.error('获取评价列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // 获取酒店列表用于筛选
  const hotels = Array.from(new Set(reviews.map(r => r.hotelId?._id)))
    .map(id => reviews.find(r => r.hotelId?._id === id)?.hotelId)
    .filter(Boolean);

  // 筛选后的评价
  let filteredReviews = reviews;
  if (hotelFilter !== 'all') {
    filteredReviews = filteredReviews.filter(r => r.hotelId?._id === hotelFilter);
  }
  if (ratingFilter !== null) {
    filteredReviews = filteredReviews.filter(r => r.rating === ratingFilter);
  }

  // 统计数据
  const stats = {
    total: reviews.length,
    avgRating: reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0',
    goodReviews: reviews.filter(r => r.rating >= 4).length,
  };

  const columns: ColumnsType<MerchantReview> = [
    {
      title: '用户',
      key: 'user',
      width: 140,
      render: (_, record) => (
        <Space>
          <Avatar src={record.userId?.avatar} size="small">
            {record.userId?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <span>{record.userId?.username || '匿名用户'}</span>
        </Space>
      ),
    },
    {
      title: '酒店',
      key: 'hotel',
      width: 160,
      render: (_, record) => (
        <div>
          <div>{record.hotelId?.name}</div>
          <div className={styles.subText}>{record.hotelId?.city}</div>
        </div>
      ),
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      width: 140,
      render: (rating) => (
        <Space>
          <Rate disabled value={rating} style={{ fontSize: 14 }} />
          <Tag color={rating >= 4 ? 'success' : rating >= 3 ? 'processing' : 'error'}>
            {rating}分
          </Tag>
        </Space>
      ),
    },
    {
      title: '评价内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '评价时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <CommentOutlined /> 评价管理
        </h2>
        <Space>
          <Select
            value={hotelFilter}
            onChange={setHotelFilter}
            style={{ width: 180 }}
            options={[
              { value: 'all', label: '全部酒店' },
              ...hotels.map(h => ({ value: h!._id, label: h!.name }))
            ]}
          />
          <Select
            value={ratingFilter}
            onChange={setRatingFilter}
            style={{ width: 120 }}
            allowClear
            placeholder="评分筛选"
            options={[
              { value: 5, label: '5星' },
              { value: 4, label: '4星' },
              { value: 3, label: '3星' },
              { value: 2, label: '2星' },
              { value: 1, label: '1星' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchReviews}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={24} className={styles.stats}>
        <Col span={8}>
          <Card>
            <Statistic title="总评价数" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="平均评分"
              value={stats.avgRating}
              suffix="/ 5"
              prefix={<StarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="好评数（4星及以上）"
              value={stats.goodReviews}
              suffix="条"
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredReviews}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default ReviewList;
