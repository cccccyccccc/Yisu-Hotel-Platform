import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, message } from 'antd';
import {
  ShopOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  ShoppingOutlined,
  BankOutlined,
  BellOutlined,
  HomeOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
  CommentOutlined,
  MessageOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import { useUserStore } from '@/stores';
import NotificationBell from '@/components/NotificationBell';
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
      key: '/merchant/dashboard',
      icon: <DashboardOutlined />,
      label: '数据统计',
    },
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
    {
      key: '/merchant/reviews',
      icon: <CommentOutlined />,
      label: '评价管理',
    },
    {
      key: '/merchant/promotions',
      icon: <PercentageOutlined />,
      label: '促销管理',
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: '消息中心',
    },
    {
      key: '/profile',
      icon: <SettingOutlined />,
      label: '个人设置',
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
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: '用户管理',
    },
    {
      key: '/admin/announcements',
      icon: <BellOutlined />,
      label: '公告管理',
    },
    {
      key: '/profile',
      icon: <SettingOutlined />,
      label: '个人设置',
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

  // 获取当前页面标题
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/merchant/dashboard')) return '数据统计';
    if (path.includes('/merchant/hotels')) return '我的酒店';
    if (path.includes('/merchant/orders')) return '订单管理';
    if (path.includes('/admin/hotels')) return '酒店审核';
    if (path.includes('/admin/banners')) return '轮播图管理';
    if (path.includes('/admin/users')) return '用户管理';
    if (path.includes('/profile')) return '个人设置';
    return '首页';
  };

  return (
    <Layout className={styles.layout}>
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className={styles.sider}
        width={240}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoBox}>
            <BankOutlined className={styles.logoIcon} />
          </div>
          {!collapsed && (
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>YISU HOTEL</span>
              <span className={styles.logoSubtitle}>MANAGEMENT</span>
            </div>
          )}
        </div>

        {/* 菜单分组标题 */}
        {!collapsed && <div className={styles.menuGroup}>DASHBOARD</div>}

        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className={styles.menu}
        />

        {/* 用户信息（底部） */}
        <div className={styles.siderFooter}>
          <Dropdown menu={{ items: userMenuItems }} placement="topRight">
            <div className={styles.userCard}>
              <Avatar src={user?.avatar} className={styles.userAvatar}>
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
              {!collapsed && (
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.username}</span>
                  <span className={styles.userRole}>
                    {user?.role === 'admin' ? 'Administrator' : 'Merchant'}
                  </span>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </Sider>

      {/* 主内容区 */}
      <Layout className={styles.mainArea}>
        {/* 顶部导航栏 */}
        <Header className={styles.header}>
          <div className={styles.headerLeft}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className={styles.triggerBtn}
            />
            <div className={styles.breadcrumb}>
              <HomeOutlined className={styles.breadcrumbIcon} />
              <span>首页</span>
              <span className={styles.breadcrumbSep}>&gt;</span>
              <span className={styles.breadcrumbCurrent}>{getPageTitle()}</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            <NotificationBell />
            <div className={styles.headerUser}>
              <span className={styles.headerUserName}>{user?.username}</span>
            </div>
          </div>
        </Header>

        {/* 内容区域 */}
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
