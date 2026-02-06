import { useEffect, useState } from 'react';
import { Table, Tag, Avatar, Card, Input, Select, Space, message } from 'antd';
import { UserOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAdminUserList } from '@/api/users';
import type { UserListItem } from '@/api/users';
import type { ColumnsType } from 'antd/es/table';
import styles from './UserList.module.css';

const { Option } = Select;

const UserList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchText, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getAdminUserList();
      setUsers(res.data);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchText) {
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'admin':
        return <Tag color="red">管理员</Tag>;
      case 'merchant':
        return <Tag color="blue">商户</Tag>;
      default:
        return <Tag color="green">普通用户</Tag>;
    }
  };

  const getGenderText = (gender?: string) => {
    switch (gender) {
      case 'male':
        return '男';
      case 'female':
        return '女';
      default:
        return '保密';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const columns: ColumnsType<UserListItem> = [
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 80,
      render: (avatar, record) => (
        <Avatar src={avatar} icon={<UserOutlined />} size={40}>
          {record.username.charAt(0)}
        </Avatar>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (val) => <span className={styles.username}>{val}</span>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: getRoleTag,
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      render: getGenderText,
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: formatDate,
    },
  ];

  // 统计数据
  const stats = {
    total: users.length,
    users: users.filter(u => u.role === 'user').length,
    merchants: users.filter(u => u.role === 'merchant').length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>用户管理</h1>
        <p className={styles.subtitle}>管理平台所有注册用户</p>
      </div>

      {/* 统计卡片 */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>总用户数</div>
        </div>
        <div className={`${styles.statCard} ${styles.userStat}`}>
          <div className={styles.statValue}>{stats.users}</div>
          <div className={styles.statLabel}>普通用户</div>
        </div>
        <div className={`${styles.statCard} ${styles.merchantStat}`}>
          <div className={styles.statValue}>{stats.merchants}</div>
          <div className={styles.statLabel}>商户</div>
        </div>
        <div className={`${styles.statCard} ${styles.adminStat}`}>
          <div className={styles.statValue}>{stats.admins}</div>
          <div className={styles.statLabel}>管理员</div>
        </div>
      </div>

      {/* 筛选区域 */}
      <Card className={styles.filterCard}>
        <Space size="middle">
          <Input
            placeholder="搜索用户名"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部角色</Option>
            <Option value="user">普通用户</Option>
            <Option value="merchant">商户</Option>
            <Option value="admin">管理员</Option>
          </Select>
          <span
            className={styles.refreshBtn}
            onClick={fetchUsers}
          >
            <ReloadOutlined /> 刷新
          </span>
        </Space>
      </Card>

      {/* 用户列表 */}
      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
    </div>
  );
};

export default UserList;
