import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, message } from 'antd';
import {
  ShopOutlined,
  AuditOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { useUserStore } from '@/stores';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useUserStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('/login');
  };

  const merchantMenuItems = [
    {
      key: '/merchant/hotels',
      icon: <ShopOutlined />,
      label: '我的酒店',
    },
    {
      key: '/merchant/orders',
      icon: <ShoppingOutlined />,
      label: '订单管理',
    },
  ];

  const adminMenuItems = [
    {
      key: '/admin/hotels',
      icon: <AuditOutlined />,
      label: '酒店审核',
    },
    {
      key: '/admin/banners',
      icon: <PictureOutlined />,
      label: '轮播图管理',
    },
  ];

  const menuItems = user?.role === 'admin' ? adminMenuItems : merchantMenuItems;

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className={styles.layout}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className={styles.sider}
        width={240}
      >
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🏨</span>
          {!collapsed && <span className={styles.logoText}>易宿管理</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className={styles.menu}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className={styles.triggerBtn}
          />
          <div className={styles.headerRight}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className={styles.userInfo}>
                <Avatar icon={<UserOutlined />} className={styles.avatar} />
                <span className={styles.username}>
                  {user?.username}
                  <span className={styles.role}>
                    {user?.role === 'admin' ? '管理员' : '商户'}
                  </span>
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
