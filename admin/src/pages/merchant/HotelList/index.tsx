import { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Input,
  Tooltip, Avatar, Dropdown, type MenuProps, App, Empty, Select
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined,
  ReloadOutlined, ArrowDownOutlined, ArrowUpOutlined,
  MoreOutlined, ShopOutlined,
  EnvironmentOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
// 确保 API 和 Hotel 接口已正确导入
import { getMyHotels, updateHotelStatus, type Hotel } from '@/api/hotels';
import styles from './HotelList.module.css';

const { Search } = Input;

const MerchantHotelList: React.FC = () => {
  const navigate = useNavigate();
  // 使用 useApp 钩子修复 message 静态方法警告
  const { message } = App.useApp();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 状态过滤值
  const [searchText, setSearchText] = useState('');

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await getMyHotels(); // 调用商户列表接口
      setHotels(res.data);
    } catch {
      message.error('获取酒店列表失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchHotels(); }, []);

  // 综合筛选逻辑：下拉框状态 + 搜索词
  const filteredHotels = useMemo(() => {
    return hotels.filter(h => {
      const matchStatus = activeFilter === 'all' || h.status === parseInt(activeFilter);
      const matchSearch = h.name.toLowerCase().includes(searchText.toLowerCase()) ||
        h.city.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [hotels, activeFilter, searchText]);

  const handleStatusChange = async (id: string, status: 1 | 3) => {
    try {
      await updateHotelStatus(id, status);
      message.success(status === 1 ? '上线成功' : '下线成功');
      fetchHotels();
    } catch {
      message.error('操作失败');
    }
  };

  // 显式指定 ColumnsType<Hotel> 修复 record 隐式 any 错误
  const columns: ColumnsType<Hotel> = [
    {
      title: '酒店详细信息',
      key: 'hotelInfo',
      render: (_, record: Hotel) => (
        <Space size="middle" align="start">
          <Avatar
            shape="square"
            size={64}
            src={record.images?.[0]}
            icon={<ShopOutlined />}
          />
          <div className={styles.infoWrapper}>
            <div className={styles.nameRow}>
              <a className={styles.mainName} onClick={() => navigate(`/merchant/hotels/${record._id}/detail`)}>
                {record.name}
              </a>
              <span className={styles.hotelId}>#{record._id.slice(-6)}</span>
            </div>
            <div className={styles.addressLine}>
              <EnvironmentOutlined /> {record.city} · {record.address}
            </div>
            <div className={styles.tagLine}>
              {/* 修复：移除了 size 属性，解决 ts(2322) 报错 */}
              {record.tags?.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>)}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '价格/星级',
      key: 'priceInfo',
      width: 140,
      render: (_, record: Hotel) => (
        <div className={styles.priceColumn}>
          <div className={styles.stars}>{'⭐'.repeat(record.starRating)}</div>
          <div className={styles.priceText}>¥{record.price.toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: number, record: Hotel) => (
        <Space>
          <Tag color={status === 1 ? 'success' : status === 0 ? 'processing' : status === 2 ? 'error' : 'default'}>
            {status === 1 ? '已发布' : status === 0 ? '审核中' : status === 2 ? '不通过' : '已下线'}
          </Tag>
          {status === 2 && record.rejectReason && (
            <Tooltip title={`拒绝原因：${record.rejectReason}`}>
              <MoreOutlined style={{ color: '#ef4444', cursor: 'pointer' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: Hotel) => {
        const moreItems: MenuProps['items'] = [
          { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => navigate(`/merchant/hotels/${record._id}/edit`) },
          { key: 'rooms', label: '房型', icon: <AppstoreOutlined />, onClick: () => navigate(`/merchant/hotels/${record._id}/rooms`) },
          record.status === 1 ? {
            key: 'off', label: '下线', danger: true, icon: <ArrowDownOutlined />,
            onClick: () => handleStatusChange(record._id, 3)
          } : null,
          record.status === 3 ? {
            key: 'on', label: '上线', icon: <ArrowUpOutlined />,
            onClick: () => handleStatusChange(record._id, 1)
          } : null,
        ].filter(Boolean) as MenuProps['items'];

        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/merchant/hotels/${record._id}/detail`)}>详情</Button>
            <Dropdown menu={{ items: moreItems }}>
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>我的房源管理</h2>
        </div>
        <Space size="middle">
          {/* 状态筛选下拉框 */}
          <Select
            defaultValue="all"
            style={{ width: 120 }}
            onChange={setActiveFilter}
            options={[
              { value: 'all', label: '全部状态' },
              { value: '0', label: '待审核' },
              { value: '1', label: '已发布' },
              { value: '2', label: '不通过' },
              { value: '3', label: '已下线' },
            ]}
          />
          <Search
            placeholder="搜索酒店名称"
            allowClear
            onSearch={setSearchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 220 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchHotels}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} className={styles.addBtn} onClick={() => navigate('/merchant/hotels/new')}>添加酒店</Button>
        </Space>
      </div>

      <div className={styles.tableWrapper}>
        <Table
          columns={columns}
          dataSource={filteredHotels}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            position: ['bottomCenter'],
            showTotal: (total) => `共 ${total} 个房源`
          }}
          locale={{ emptyText: <Empty description="未找到匹配的房源" /> }}
        />
      </div>
    </div>
  );
};

export default MerchantHotelList;