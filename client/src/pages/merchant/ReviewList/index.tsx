import { useEffect, useState } from 'react';
import {
  Table, Card, Tag, message, Space, Button, Select, Rate, Avatar,
  Statistic, Row, Col, Modal, Input, Tooltip, DatePicker
} from 'antd';
import {
  ReloadOutlined, CommentOutlined, StarOutlined, MessageOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { getMerchantReviews, replyToReview } from '@/api/reviews';
import type { MerchantReview } from '@/api/reviews';
import type { ColumnsType } from 'antd/es/table';
import styles from './ReviewList.module.css';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useSearchParams } from 'react-router-dom';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

const ReviewList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [reviews, setReviews] = useState<MerchantReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  // 初始化时检查URL参数
  useEffect(() => {
    const monthParam = searchParams.get('month');
    if (monthParam === 'current') {
      const startOfMonth = dayjs().startOf('month');
      const today = dayjs();
      setDateRange([startOfMonth, today]);
    }
  }, [searchParams]);

  // 回复相关状态
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [currentReview, setCurrentReview] = useState<MerchantReview | null>(null);
  const [replyContent, setReplyContent] = useState('');

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

  // 打开回复弹窗
  const handleOpenReply = (record: MerchantReview) => {
    setCurrentReview(record);
    setReplyContent(record.reply || '');
    setReplyModalVisible(true);
  };

  // 提交回复
  const handleSubmitReply = async () => {
    if (!currentReview) return;
    if (!replyContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }

    setReplyLoading(true);
    try {
      await replyToReview(currentReview._id, replyContent.trim());
      message.success('回复成功');
      setReplyModalVisible(false);
      setReplyContent('');
      fetchReviews();
    } catch (error) {
      message.error('回复失败');
    } finally {
      setReplyLoading(false);
    }
  };

  // 获取酒店列表用于筛选
  const hotels = Array.from(new Set(reviews.map(r => r.hotelId?._id)))
    .map(id => reviews.find(r => r.hotelId?._id === id)?.hotelId)
    .filter(Boolean);

  // 筛选后的评价
  let filteredReviews = reviews;
  if (hotelFilter !== 'all') {
    filteredReviews = filteredReviews.filter(r => r.hotelId?._id === hotelFilter);
  }
  if (ratingFilter !== 'all') {
    filteredReviews = filteredReviews.filter(r => r.rating === Number(ratingFilter));
  }
  if (dateRange) {
    filteredReviews = filteredReviews.filter(r => {
      const reviewDate = dayjs(r.createdAt);
      return !reviewDate.isBefore(dateRange[0], 'day') && !reviewDate.isAfter(dateRange[1], 'day');
    });
  }

  // 统计数据 (基于筛选后的评价)
  const stats = {
    total: filteredReviews.length,
    avgRating: filteredReviews.length > 0
      ? (filteredReviews.reduce((sum, r) => sum + r.rating, 0) / filteredReviews.length).toFixed(1)
      : '0',
    goodReviews: filteredReviews.filter(r => r.rating >= 4).length,
    replied: filteredReviews.filter(r => r.reply).length,
  };

  const columns: ColumnsType<MerchantReview> = [
    {
      title: '用户',
      key: 'user',
      width: 120,
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
      width: 140,
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
      width: 130,
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
      render: (content, record) => (
        <div>
          <div>{content}</div>
          {record.reply && (
            <div className={styles.replyBox}>
              <Tag color="blue" icon={<MessageOutlined />}>商户回复</Tag>
              <span className={styles.replyText}>{record.reply}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (date) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        record.reply ? (
          <Tooltip title={`已于 ${dayjs(record.replyAt).format('YYYY-MM-DD HH:mm')} 回复`}>
            <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#10b981' }}>
              已回复
            </Button>
          </Tooltip>
        ) : (
          <Button
            type="link"
            icon={<MessageOutlined />}
            onClick={() => handleOpenReply(record)}
          >
            回复
          </Button>
        )
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <CommentOutlined /> 评价管理
        </h2>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
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
            options={[
              { value: 'all', label: '全部评分' },
              { value: '5', label: '5星' },
              { value: '4', label: '4星' },
              { value: '3', label: '3星' },
              { value: '2', label: '2星' },
              { value: '1', label: '1星' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchReviews}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={24} className={styles.stats}>
        <Col span={6}>
          <Card>
            <Statistic title="总评价数" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
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
        <Col span={6}>
          <Card>
            <Statistic
              title="好评数"
              value={stats.goodReviews}
              suffix="条"
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已回复"
              value={stats.replied}
              suffix={`/ ${stats.total}`}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#3b82f6' }}
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

      {/* 回复弹窗 */}
      <Modal
        title="回复评价"
        open={replyModalVisible}
        onCancel={() => {
          setReplyModalVisible(false);
          setReplyContent('');
        }}
        onOk={handleSubmitReply}
        confirmLoading={replyLoading}
        okText="提交回复"
        cancelText="取消"
      >
        {currentReview && (
          <div className={styles.replyModal}>
            <div className={styles.originalReview}>
              <div className={styles.reviewHeader}>
                <Avatar src={currentReview.userId?.avatar} size="small">
                  {currentReview.userId?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <span className={styles.reviewUser}>{currentReview.userId?.username}</span>
                <Rate disabled value={currentReview.rating} style={{ fontSize: 12 }} />
              </div>
              <div className={styles.reviewContent}>{currentReview.content}</div>
            </div>
            <TextArea
              rows={4}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="请输入回复内容..."
              maxLength={500}
              showCount
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReviewList;
