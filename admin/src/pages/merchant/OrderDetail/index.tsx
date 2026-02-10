import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Tag, message, Button, Descriptions, Avatar,
  Timeline, Spin, Divider
} from 'antd';
import {
  ArrowLeftOutlined, UserOutlined, HomeOutlined,
  CalendarOutlined, ShoppingOutlined, DollarOutlined,
  ClockCircleOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrderDetail } from '@/api/orders';
import type { Order } from '@/api/orders';
import styles from './OrderDetail.module.css';
import dayjs from 'dayjs';

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'processing', text: '待支付' },
  paid: { color: 'success', text: '已支付' },
  completed: { color: 'default', text: '已完成' },
  cancelled: { color: 'error', text: '已取消' },
};

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId]);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const res = await getOrderDetail(orderId!);
      setOrder(res.data);
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateNights = () => {
    if (!order) return 0;
    return dayjs(order.checkOutDate).diff(dayjs(order.checkInDate), 'day');
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.container}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <div className={styles.notFound}>订单不存在</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/merchant/orders')}>
          返回订单列表
        </Button>
        <div className={styles.orderInfo}>
          <span className={styles.orderId}>订单号: #{order._id.slice(-8)}</span>
          <Tag color={statusMap[order.status]?.color} className={styles.statusTag}>
            {statusMap[order.status]?.text}
          </Tag>
        </div>
      </div>

      <Row gutter={24}>
        {/* 左侧：订单信息 */}
        <Col xs={24} lg={16}>
          {/* 酒店信息 */}
          <Card
            title={<><HomeOutlined /> 酒店信息</>}
            className={styles.card}
          >
            <Descriptions column={2}>
              <Descriptions.Item label="酒店名称">{order.hotelId?.name}</Descriptions.Item>
              <Descriptions.Item label="城市">{order.hotelId?.city}</Descriptions.Item>
              {order.hotelId?.nameEn && (
                <Descriptions.Item label="英文名">{order.hotelId.nameEn}</Descriptions.Item>
              )}
              {order.hotelId?.address && (
                <Descriptions.Item label="地址" span={2}>{order.hotelId.address}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 房型信息 */}
          <Card
            title={<><ShoppingOutlined /> 房型信息</>}
            className={styles.card}
          >
            <Descriptions column={2}>
              <Descriptions.Item label="房型名称">{order.roomTypeId?.title}</Descriptions.Item>
              <Descriptions.Item label="预订数量">{order.quantity} 间</Descriptions.Item>
              {order.roomTypeId?.bedInfo && (
                <Descriptions.Item label="床型">{order.roomTypeId.bedInfo}</Descriptions.Item>
              )}
              {order.roomTypeId?.size && (
                <Descriptions.Item label="面积">{order.roomTypeId.size}</Descriptions.Item>
              )}
              <Descriptions.Item label="单价">¥{order.roomTypeId?.price}/晚</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 入住信息 */}
          <Card
            title={<><CalendarOutlined /> 入住信息</>}
            className={styles.card}
          >
            <div className={styles.dateRange}>
              <div className={styles.dateItem}>
                <div className={styles.dateLabel}>入住日期</div>
                <div className={styles.dateValue}>
                  {dayjs(order.checkInDate).format('YYYY年MM月DD日')}
                </div>
                <div className={styles.dateWeekday}>
                  {dayjs(order.checkInDate).format('dddd')}
                </div>
              </div>
              <div className={styles.dateArrow}>
                <div className={styles.nights}>{calculateNights()}晚</div>
                <div className={styles.arrowLine}></div>
              </div>
              <div className={styles.dateItem}>
                <div className={styles.dateLabel}>退房日期</div>
                <div className={styles.dateValue}>
                  {dayjs(order.checkOutDate).format('YYYY年MM月DD日')}
                </div>
                <div className={styles.dateWeekday}>
                  {dayjs(order.checkOutDate).format('dddd')}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧：用户和支付信息 */}
        <Col xs={24} lg={8}>
          {/* 用户信息 */}
          <Card
            title={<><UserOutlined /> 预订用户</>}
            className={styles.card}
          >
            <div className={styles.userInfo}>
              <Avatar
                size={64}
                src={order.userId?.avatar}
                icon={<UserOutlined />}
              />
              <div className={styles.userName}>{order.userId?.username}</div>
            </div>
          </Card>

          {/* 支付信息 */}
          <Card
            title={<><DollarOutlined /> 支付信息</>}
            className={styles.card}
          >
            <div className={styles.priceBreakdown}>
              <div className={styles.priceRow}>
                <span>房费单价</span>
                <span>¥{order.roomTypeId?.price}/晚</span>
              </div>
              <div className={styles.priceRow}>
                <span>入住天数</span>
                <span>{calculateNights()}晚</span>
              </div>
              <div className={styles.priceRow}>
                <span>房间数量</span>
                <span>{order.quantity}间</span>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div className={`${styles.priceRow} ${styles.total}`}>
                <span>订单总额</span>
                <span className={styles.totalPrice}>¥{order.totalPrice}</span>
              </div>
            </div>
          </Card>

          {/* 订单时间线 */}
          <Card
            title={<><ClockCircleOutlined /> 订单进度</>}
            className={styles.card}
          >
            <Timeline
              items={[
                {
                  color: 'green',
                  dot: <CheckCircleOutlined />,
                  children: (
                    <>
                      <div>订单创建</div>
                      <div className={styles.timelineTime}>
                        {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                    </>
                  ),
                },
                ...(order.status !== 'pending' ? [{
                  color: order.status === 'cancelled' ? 'red' : 'green',
                  children: (
                    <>
                      <div>{statusMap[order.status]?.text}</div>
                      <div className={styles.timelineTime}>
                        {order.updatedAt
                          ? dayjs(order.updatedAt).format('YYYY-MM-DD HH:mm:ss')
                          : '-'
                        }
                      </div>
                    </>
                  ),
                }] : []),
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OrderDetail;
