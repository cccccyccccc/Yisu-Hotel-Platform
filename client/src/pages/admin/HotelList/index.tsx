import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Tag, message, Modal, Input,
  Tooltip, Tabs, Badge
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined
} from '@ant-design/icons';
import { getAdminHotelList, auditHotel, updateHotelStatus } from '@/api/hotels';
import type { ColumnsType } from 'antd/es/table';
import styles from './HotelList.module.css';

const { TextArea } = Input;

// Hotel 类型定义
interface Hotel {
  _id: string;
  merchantId: string;
  name: string;
  nameEn?: string;
  city: string;
  address: string;
  starRating: number;
  score?: number;
  price: number;
  openingTime?: string;
  description?: string;
  tags?: string[];
  images?: string[];
  nearbyAttractions?: string[];
  nearbyTransport?: string[];
  nearbyMalls?: string[];
  status: 0 | 1 | 2 | 3;
  rejectReason?: string;
}

const statusMap: Record<number, { color: string; text: string }> = {
  0: { color: 'processing', text: '待审核' },
  1: { color: 'success', text: '已发布' },
  2: { color: 'error', text: '已拒绝' },
  3: { color: 'default', text: '已下线' },
};

const AdminHotelList: React.FC = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; hotelId: string }>({
    visible: false,
    hotelId: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [detailModal, setDetailModal] = useState<{ visible: boolean; hotel: Hotel | null }>({
    visible: false,
    hotel: null,
  });

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await getAdminHotelList();
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

  const handleApprove = async (id: string) => {
    try {
      await auditHotel(id, { status: 1 });
      message.success('审核通过');
      fetchHotels();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('请输入拒绝原因');
      return;
    }
    try {
      await auditHotel(rejectModal.hotelId, { status: 2, rejectReason });
      message.success('已拒绝');
      setRejectModal({ visible: false, hotelId: '' });
      setRejectReason('');
      fetchHotels();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleStatusChange = async (id: string, status: 1 | 3) => {
    try {
      await updateHotelStatus(id, status);
      message.success(status === 1 ? '已上线' : '已下线');
      fetchHotels();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const filteredHotels = hotels.filter(h => {
    if (activeTab === 'all') return true;
    return h.status === parseInt(activeTab);
  });

  const getCounts = () => ({
    all: hotels.length,
    pending: hotels.filter(h => h.status === 0).length,
    published: hotels.filter(h => h.status === 1).length,
    rejected: hotels.filter(h => h.status === 2).length,
    offline: hotels.filter(h => h.status === 3).length,
  });

  const counts = getCounts();

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
      render: (val) => '⭐'.repeat(val),
    },
    {
      title: '起价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (val) => <span className={styles.price}>¥{val}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => (
        <Tooltip title={status === 2 ? `拒绝原因: ${record.rejectReason}` : ''}>
          <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setDetailModal({ visible: true, hotel: record })}
            />
          </Tooltip>
          {record.status === 0 && (
            <>
              <Tooltip title="通过">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => handleApprove(record._id)}
                />
              </Tooltip>
              <Tooltip title="拒绝">
                <Button
                  type="text"
                  icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  onClick={() => setRejectModal({ visible: true, hotelId: record._id })}
                />
              </Tooltip>
            </>
          )}
          {record.status === 1 && (
            <Tooltip title="下线">
              <Button
                type="text"
                icon={<ArrowDownOutlined style={{ color: '#faad14' }} />}
                onClick={() => handleStatusChange(record._id, 3)}
              />
            </Tooltip>
          )}
          {record.status === 3 && (
            <Tooltip title="上线">
              <Button
                type="text"
                icon={<ArrowUpOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleStatusChange(record._id, 1)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>酒店审核管理</h2>
        <Button icon={<ReloadOutlined />} onClick={fetchHotels}>刷新</Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'all', label: <Badge count={counts.all} showZero>全部</Badge> },
          { key: '0', label: <Badge count={counts.pending} showZero color="blue">待审核</Badge> },
          { key: '1', label: <Badge count={counts.published} showZero color="green">已发布</Badge> },
          { key: '2', label: <Badge count={counts.rejected} showZero color="red">已拒绝</Badge> },
          { key: '3', label: <Badge count={counts.offline} showZero color="default">已下线</Badge> },
        ]}
        className={styles.tabs}
      />

      <Table
        columns={columns}
        dataSource={filteredHotels}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 拒绝原因弹窗 */}
      <Modal
        title="拒绝审核"
        open={rejectModal.visible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModal({ visible: false, hotelId: '' });
          setRejectReason('');
        }}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
      >
        <p>请输入拒绝原因：</p>
        <TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入拒绝原因，将通知商户"
        />
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="酒店详情"
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, hotel: null })}
        footer={null}
        width={700}
      >
        {detailModal.hotel && (
          <div className={styles.detail}>
            <div className={styles.detailRow}>
              <span className={styles.label}>酒店名称：</span>
              <span>{detailModal.hotel.name} {detailModal.hotel.nameEn && `(${detailModal.hotel.nameEn})`}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>所在城市：</span>
              <span>{detailModal.hotel.city}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>详细地址：</span>
              <span>{detailModal.hotel.address}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>星级：</span>
              <span>{'⭐'.repeat(detailModal.hotel.starRating)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>起始价格：</span>
              <span className={styles.price}>¥{detailModal.hotel.price}</span>
            </div>
            {detailModal.hotel.description && (
              <div className={styles.detailRow}>
                <span className={styles.label}>简介：</span>
                <span>{detailModal.hotel.description}</span>
              </div>
            )}
            {detailModal.hotel.tags && detailModal.hotel.tags.length > 0 && (
              <div className={styles.detailRow}>
                <span className={styles.label}>标签：</span>
                <span>{detailModal.hotel.tags.map(t => <Tag key={t}>{t}</Tag>)}</span>
              </div>
            )}
            {detailModal.hotel.images && detailModal.hotel.images.length > 0 && (
              <div className={styles.detailRow}>
                <span className={styles.label}>图片：</span>
                <div className={styles.imageGrid}>
                  {detailModal.hotel.images.map((img, idx) => (
                    <img key={idx} src={img} alt={`酒店图片${idx + 1}`} className={styles.image} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminHotelList;
