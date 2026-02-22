import React, { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, message, Modal, Input,
  Tooltip, Descriptions, Image, Divider, Empty, Typography, Drawer, Row, Col
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, SearchOutlined,
  EyeOutlined, ReloadOutlined, EnvironmentOutlined, ShopOutlined
} from '@ant-design/icons';
import { getAdminHotelList, auditHotel, updateHotelStatus } from '@/api/hotels';
import type { ColumnsType } from 'antd/es/table';
import styles from './HotelList.module.css';

const { TextArea } = Input;
const { Text } = Typography;

// 酒店类型定义
interface Hotel {
  _id: string;
  merchantId: string;
  name: string;
  nameEn?: string;
  city: string;
  address: string;
  location?: { type: 'Point'; coordinates: [number, number] };
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
  createdAt?: string;
}

// 状态映射配置 (结合了你的 CSS 类名)
const STATUS_CONFIG: Record<number | string, { text: string; badgeClass: string; tagColor: string }> = {
  all: { text: '全部房源', badgeClass: 'badgeBlue', tagColor: 'processing' },
  0: { text: '待审核', badgeClass: 'badgeOrange', tagColor: 'warning' },
  1: { text: '已发布', badgeClass: 'badgeGreen', tagColor: 'success' },
  2: { text: '已拒绝', badgeClass: 'badgeRed', tagColor: 'error' },
  3: { text: '已下线', badgeClass: 'badgeGray', tagColor: 'default' },
};

const AdminHotelList: React.FC = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 记录当前正在操作的记录ID
  
  // 检索与筛选状态
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  // 弹窗状态
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; hotelId: string }>({ visible: false, hotelId: '' });
  const [rejectReason, setRejectReason] = useState('');
  
  // 企业级展示：使用 Drawer 替代 Modal
  const [detailDrawer, setDetailDrawer] = useState<{ visible: boolean; hotel: Hotel | null }>({ visible: false, hotel: null });

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await getAdminHotelList();
      setHotels(res.data || []);
    } catch {
      message.error('获取酒店列表失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  // 状态统计
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: hotels.length };
    [0, 1, 2, 3].forEach(s => {
      counts[s.toString()] = hotels.filter(h => h.status === s).length;
    });
    return counts;
  }, [hotels]);

  // 综合过滤：状态栏 + 搜索框
  const filteredHotels = useMemo(() => {
    return hotels.filter(h => {
      const matchStatus = activeFilter === 'all' || h.status === parseInt(activeFilter);
      const matchSearch = h.name.includes(searchText) || h.city.includes(searchText);
      return matchStatus && matchSearch;
    });
  }, [hotels, activeFilter, searchText]);

  // --- 操作逻辑 ---
  const handleApprove = (id: string) => {
    Modal.confirm({
      title: '确认通过审核？',
      content: '审核通过后，该房源将立即在 C 端向用户展示。',
      okText: '确认发布',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(id);
        try {
          await auditHotel(id, { status: 1 });
          message.success('审核已通过，房源已上线');
          fetchHotels();
          if (detailDrawer.visible) setDetailDrawer({ visible: false, hotel: null });
        } catch { message.error('操作失败'); }
        finally { setActionLoading(null); }
      },
    });
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return message.warning('必须输入明确的拒绝原因');
    setActionLoading('reject');
    try {
      await auditHotel(rejectModal.hotelId, { status: 2, rejectReason });
      message.success('已驳回该入驻申请');
      setRejectModal({ visible: false, hotelId: '' });
      setRejectReason('');
      fetchHotels();
    } catch { message.error('操作失败'); }
    finally { setActionLoading(null); }
  };

  const handleStatusChange = async (id: string, status: 1 | 3) => {
    setActionLoading(id);
    try {
      await updateHotelStatus(id, status);
      message.success(status === 1 ? '酒店已重新上线' : '酒店已强制下线');
      fetchHotels();
    } catch { message.error('状态变更失败'); }
    finally { setActionLoading(null); }
  };

  const columns: ColumnsType<Hotel> = [
    {
      title: '酒店信息',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className={styles.hotelName}>
          <span className={styles.mainName}>{text}</span>
          <span className={styles.hotelId}>ID: {record._id.slice(-8).toUpperCase()}</span>
        </div>
      ),
    },
    { title: '所在城市', dataIndex: 'city', key: 'city', width: 100 },
    {
      title: '基础价格',
      dataIndex: 'price',
      key: 'price',
      sorter: (a, b) => a.price - b.price,
      render: (val) => <span className={styles.price}>¥{val}</span>
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const conf = STATUS_CONFIG[status];
        return <Tag color={conf.tagColor} bordered={false}>{conf.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        const isActionLoading = actionLoading === record._id;
        return (
          <Space size="small">
            <Tooltip title="详情分析">
              <Button type="text" className={styles.actionBtn} icon={<EyeOutlined />} onClick={() => setDetailDrawer({ visible: true, hotel: record })} />
            </Tooltip>
            {record.status === 0 && (
              <>
                <Tooltip title="快速通过">
                  <Button type="text" loading={isActionLoading} icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => handleApprove(record._id)} />
                </Tooltip>
                <Tooltip title="驳回申请">
                  <Button type="text" icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} onClick={() => setRejectModal({ visible: true, hotelId: record._id })} />
                </Tooltip>
              </>
            )}
            {record.status === 1 && <Button type="link" danger size="small" loading={isActionLoading} onClick={() => handleStatusChange(record._id, 3)}>强制下线</Button>}
            {record.status === 3 && <Button type="link" size="small" loading={isActionLoading} onClick={() => handleStatusChange(record._id, 1)}>恢复上线</Button>}
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      {/* 头部与操作区 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>房源审核与管理</h2>
          <p className={styles.subtitle}>统一管理平台内所有商户提交的酒店房源信息</p>
        </div>
        <Space>
          <Input.Search
            placeholder="搜索酒店名称或城市..."
            allowClear
            onSearch={val => setSearchText(val)}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchHotels}>刷新</Button>
        </Space>
      </div>

      {/* 现代化状态筛选 Tabs (应用了你写的 CSS) */}
      <div className={styles.filterTabs}>
        {['all', '0', '1', '2', '3'].map(key => {
          const conf = STATUS_CONFIG[key];
          const isActive = activeFilter === key;
          return (
            <div 
              key={key} 
              className={`${styles.filterTab} ${isActive ? styles.filterTabActive : ''}`}
              onClick={() => setActiveFilter(key)}
            >
              <span className={styles.filterLabel}>{conf.text}</span>
              <span className={`${styles.filterBadge} ${styles[conf.badgeClass]}`}>
                {statusCounts[key]}
              </span>
            </div>
          );
        })}
      </div>

      {/* 列表区 */}
      <div className={styles.tableWrapper}>
        <Table 
          columns={columns} 
          dataSource={filteredHotels} 
          rowKey="_id" 
          loading={loading} 
          pagination={{ 
            showSizeChanger: true, 
            defaultPageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`
          }} 
        />
      </div>

      {/* 企业级 Drawer 详情页 */}
      <Drawer
        title={
          <Space>
            <ShopOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>房源详细档案</span>
            {detailDrawer.hotel && <Tag color={STATUS_CONFIG[detailDrawer.hotel.status].tagColor}>{STATUS_CONFIG[detailDrawer.hotel.status].text}</Tag>}
          </Space>
        }
        placement="right"
        width={720}
        onClose={() => setDetailDrawer({ visible: false, hotel: null })}
        open={detailDrawer.visible}
        extra={
          detailDrawer.hotel?.status === 0 && (
            <Space>
              <Button danger onClick={() => setRejectModal({ visible: true, hotelId: detailDrawer.hotel!._id })}>驳回</Button>
              <Button type="primary" loading={actionLoading === detailDrawer.hotel?._id} onClick={() => handleApprove(detailDrawer.hotel!._id)}>审核通过</Button>
            </Space>
          )
        }
      >
        {detailDrawer.hotel && (
          <div className={styles.drawerContent}>
            {detailDrawer.hotel.status === 2 && (
              <div style={{ marginBottom: 24, padding: '12px 16px', background: '#fff2f0', borderLeft: '4px solid #ff4d4f', borderRadius: '4px' }}>
                <Text type="danger" strong>驳回原因：</Text>
                <div>{detailDrawer.hotel.rejectReason}</div>
              </div>
            )}

            <Descriptions title="基础档案" bordered size="middle" column={2}>
              <Descriptions.Item label="酒店全称" span={2}><Text strong>{detailDrawer.hotel.name}</Text></Descriptions.Item>
              <Descriptions.Item label="英文名称">{detailDrawer.hotel.nameEn || '-'}</Descriptions.Item>
              <Descriptions.Item label="评级标准"><span style={{ color: '#faad14', letterSpacing: 2 }}>{'★'.repeat(detailDrawer.hotel.starRating)}</span></Descriptions.Item>
              <Descriptions.Item label="起步价格"><Text type="danger" strong style={{ fontSize: 16 }}>¥{detailDrawer.hotel.price}</Text></Descriptions.Item>
              <Descriptions.Item label="开业年份">{detailDrawer.hotel.openingTime || '未提供'}</Descriptions.Item>
              <Descriptions.Item label="地理位置" span={2}>
                <EnvironmentOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                {detailDrawer.hotel.city} · {detailDrawer.hotel.address}
              </Descriptions.Item>
            </Descriptions>

            <Divider />
            
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>设施与周边</h3>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>商户特色标签：</Text>
                {detailDrawer.hotel.tags?.length ? detailDrawer.hotel.tags.map(t => <Tag key={t} color="blue">{t}</Tag>) : <Text type="secondary">无标签</Text>}
              </Col>
              <Col span={24}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>详细描述：</Text>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, lineHeight: 1.6 }}>
                  {detailDrawer.hotel.description || '暂无描述'}
                </div>
              </Col>
            </Row>

            <Divider />

            <h3 style={{ marginBottom: 16, fontSize: 16 }}>商户实拍影像 ({detailDrawer.hotel.images?.length || 0})</h3>
            {detailDrawer.hotel.images?.length ? (
               <Image.PreviewGroup>
                 <div className={styles.imageGrid}>
                   {detailDrawer.hotel.images.map((img, i) => (
                     <Image key={i} src={img} className={styles.image} />
                   ))}
                 </div>
               </Image.PreviewGroup>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="商户未上传任何环境图片" />
            )}
          </div>
        )}
      </Drawer>

      {/* 驳回原因录入 Modal */}
      <Modal 
        title="驳回入驻申请" 
        open={rejectModal.visible} 
        onCancel={() => setRejectModal({ visible: false, hotelId: '' })}
        footer={[
          <Button key="back" onClick={() => setRejectModal({ visible: false, hotelId: '' })}>取消</Button>,
          <Button key="submit" type="primary" danger loading={actionLoading === 'reject'} onClick={handleReject}>确认驳回</Button>
        ]}
      >
        <div style={{ marginBottom: 12, color: '#64748b' }}>请明确填写驳回理由，该理由将直接反馈至商户端：</div>
        <TextArea 
          rows={4} 
          value={rejectReason} 
          onChange={(e) => setRejectReason(e.target.value)} 
          placeholder="例如：营业执照模糊、虚假地址定位、图片含有竞品水印等..." 
        />
      </Modal>
    </div>
  );
};

export default AdminHotelList;