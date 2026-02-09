import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Tag, message,
  Tooltip, Empty, Dropdown, Select
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined,
  MoreOutlined, ReloadOutlined, AppstoreOutlined,
  ExclamationCircleOutlined, CrownOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMyHotels, updateHotelStatus } from '@/api/hotels';
import type { ColumnsType } from 'antd/es/table';
import styles from './HotelList.module.css';

// Hotel 类型定义
interface Hotel {
  _id: string;
  name: string;
  nameEn?: string;
  city: string;
  starRating: number;
  price: number;
  status: 0 | 1 | 2 | 3;
  rejectReason?: string;
}

const statusMap: Record<number, { color: string; text: string }> = {
  0: { color: 'processing', text: '待审核' },
  1: { color: 'success', text: '已发布' },
  2: { color: 'error', text: '已拒绝' },
  3: { color: 'default', text: '已下线' },
};

const MerchantHotelList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 初始化时检查URL参数
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam !== null) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await getMyHotels();
      setHotels(res.data);
    } catch (error) {
      message.error('获取酒店列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  // 筛选后的酒店列表
  const filteredHotels = statusFilter === 'all'
    ? hotels
    : hotels.filter(h => h.status === Number(statusFilter));

  const handleStatusChange = async (id: string, status: 1 | 3) => {
    try {
      await updateHotelStatus(id, status);
      message.success(status === 1 ? '上线成功' : '下线成功');
      fetchHotels();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns: ColumnsType<Hotel> = [
    {
      title: '酒店名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className={styles.hotelName}>
          <div className={styles.mainName}>{text}</div>
          {record.nameEn && <div className={styles.enName}>{record.nameEn}</div>}
        </div>
      ),
    },
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      width: 100,
    },
    {
      title: '星级',
      dataIndex: 'starRating',
      key: 'starRating',
      width: 120,
      render: (val) => (
        <span className={styles.starRating}>
          <CrownOutlined className={styles.crownIcon} />
          <span>{val}星级</span>
        </span>
      ),
    },
    {
      title: '起价',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (val) => <span className={styles.price}>¥{val}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status, record) => (
        <Space>
          <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
          {status === 2 && record.rejectReason && (
            <Tooltip title={`拒绝原因：${record.rejectReason}`}>
              <ExclamationCircleOutlined style={{ color: '#ef4444', cursor: 'pointer' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/merchant/hotels/${record._id}/detail`)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/merchant/hotels/${record._id}/edit`)}
            />
          </Tooltip>
          <Tooltip title="房型管理">
            <Button
              type="text"
              icon={<AppstoreOutlined />}
              onClick={() => navigate(`/merchant/hotels/${record._id}/rooms`)}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                record.status === 1 ? {
                  key: 'offline',
                  label: '下线',
                  onClick: () => handleStatusChange(record._id, 3),
                } : record.status === 3 ? {
                  key: 'online',
                  label: '重新上线',
                  onClick: () => handleStatusChange(record._id, 1),
                } : null,
              ].filter(Boolean) as { key: string; label: string; onClick: () => void }[],
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>我的酒店</h2>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: '0', label: '待审核' },
              { value: '1', label: '已发布' },
              { value: '2', label: '审核不通过' },
              { value: '3', label: '已下线' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchHotels}>刷新</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/merchant/hotels/new')}
            className={styles.addBtn}
          >
            添加酒店
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredHotels}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: (
            <Empty
              description="暂无酒店"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                onClick={() => navigate('/merchant/hotels/new')}
              >
                立即添加
              </Button>
            </Empty>
          ),
        }}
      />
    </div>
  );
};

export default MerchantHotelList;
