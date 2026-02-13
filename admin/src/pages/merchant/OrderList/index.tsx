import { useEffect, useState } from 'react';
import {
  Table, Card, Row, Col, Tag, message, Statistic,
  Space, Button, Select, Tooltip, DatePicker
} from 'antd';
import {
  ReloadOutlined, ShoppingOutlined, EyeOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMerchantOrders } from '@/api/orders';
import type { ColumnsType } from 'antd/es/table';
import styles from './OrderList.module.css';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface Order {
  _id: string;
  userId: {
    _id: string;
    username: string;
  };
  hotelId: {
    _id: string;
    name: string;
    city: string;
  };
  roomTypeId: {
    _id: string;
    title: string;
    price: number;
    stock: number;
  };
  checkInDate: string;
  checkOutDate: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  createdAt: string;
}

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'processing', text: '待支付' },
  paid: { color: 'success', text: '已支付' },
  completed: { color: 'default', text: '已完成' },
  cancelled: { color: 'error', text: '已取消' },
};

const OrderList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotelFilter, setHotelFilter] = useState<string>('all');
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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await getMerchantOrders();
      setOrders(res.data);
    } catch {
      message.error('获取订单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 获取酒店列表用于筛选
  const hotels = Array.from(new Set(orders.map(o => o.hotelId?._id)))
    .map(id => orders.find(o => o.hotelId?._id === id)?.hotelId)
    .filter(Boolean);

  // 筛选后的订单
  const filteredOrders = orders.filter(o => {
    // 酒店筛选
    if (hotelFilter !== 'all' && o.hotelId?._id !== hotelFilter) return false;

    // 日期筛选 — 入住日期 >= 开始日期，退房日期 == 结束日期
    if (dateRange) {
      const checkIn = dayjs(o.checkInDate);
      const checkOut = dayjs(o.checkOutDate);
      if (checkIn.isBefore(dateRange[0], 'day') || checkIn.isAfter(dateRange[1], 'day')) {
        return false;
      }
      if (!checkOut.isSame(dateRange[1], 'day')) {
        return false;
      }
    }

    return true;
  });

  // 统计数据
  const stats = {
    total: filteredOrders.length,
    paid: filteredOrders.filter(o => o.status === 'paid').length,
    revenue: filteredOrders
      .filter(o => ['paid', 'completed'].includes(o.status))
      .reduce((sum, o) => sum + o.totalPrice, 0),
  };

  const columns: ColumnsType<Order> = [
    {
      title: '订单号',
      dataIndex: '_id',
      key: '_id',
      width: 100,
      render: (id) => <span className={styles.orderId}>#{id.slice(-6)}</span>,
    },
    {
      title: '酒店',
      dataIndex: ['hotelId', 'name'],
      key: 'hotel',
      width: 150,
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <div className={styles.subText}>{record.hotelId?.city}</div>
        </div>
      ),
    },
    {
      title: '房型',
      dataIndex: ['roomTypeId', 'title'],
      key: 'room',
      width: 120,
    },
    {
      title: '用户',
      dataIndex: ['userId', 'username'],
      key: 'user',
      width: 100,
    },
    {
      title: '入住日期',
      key: 'dates',
      width: 160,
      render: (_, record) => (
        <div>
          <div>{dayjs(record.checkInDate).format('MM-DD')}</div>
          <div className={styles.subText}>至 {dayjs(record.checkOutDate).format('MM-DD')}</div>
        </div>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 60,
      render: (val) => `${val}间`,
    },
    {
      title: '金额',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 100,
      render: (val) => <span className={styles.price}>¥{val}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/merchant/orders/${record._id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <ShoppingOutlined /> 订单管理
        </h2>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange(null);
              }
            }}
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
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={24} className={styles.stats}>
        <Col span={8}>
          <Card>
            <Statistic title="总订单数" value={stats.total} suffix="单" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待处理订单"
              value={stats.paid}
              suffix="单"
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.revenue}
              prefix="¥"
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default OrderList;
