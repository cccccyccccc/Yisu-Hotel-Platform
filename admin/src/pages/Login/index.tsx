import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '@/api/auth';
import { useUserStore } from '@/stores';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await login(values);
      const { token, user } = res.data;
      setUser(user, token);
      message.success('登录成功！');

      // 根据角色跳转到不同页面
      if (user.role === 'admin') {
        navigate('/admin/hotels');
      } else if (user.role === 'merchant') {
        navigate('/merchant/hotels');
      } else {
        message.info('普通用户请使用移动端应用');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      message.error(err.response?.data?.msg || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 背景图片 */}
      <div className={styles.background}>
        <img
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80"
          alt="Hotel Background"
          className={styles.bgImage}
        />
        <div className={styles.overlay} />
      </div>

      {/* 登录面板 */}
      <div className={styles.glassPanel}>
        {/* Logo 和标题 */}
        <div className={styles.header}>
          <div className={styles.logoBox}>
            <BankOutlined className={styles.logoIcon} />
          </div>
          <h1 className={styles.title}>易宿酒店平台</h1>
          <p className={styles.subtitle}>Yisu Hotel Platform</p>
        </div>

        {/* Tab 标签 */}
        <div className={styles.tabBar}>
          <button className={styles.tabActive}>账号登录</button>
        </div>

        {/* 登录表单 */}
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          className={styles.form}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <div className={styles.inputWrapper}>
              <UserOutlined className={styles.inputIcon} />
              <Input
                placeholder="请输入账号"
                className={styles.glassInput}
                bordered={false}
              />
            </div>
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <div className={styles.inputWrapper}>
              <LockOutlined className={styles.inputIcon} />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                className={styles.glassInput}
                bordered={false}
              />
              <span
                className={styles.eyeIcon}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              </span>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className={styles.submitBtn}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        {/* 注册链接 */}
        <div className={styles.footer}>
          <span>还没有账号？</span>
          <Link to="/register" className={styles.link}>
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
