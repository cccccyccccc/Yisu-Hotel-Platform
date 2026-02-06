import { useState } from 'react';
import { Form, Input, Button, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '@/api/auth';
import { useUserStore } from '@/stores';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);

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
    <div className={styles.loginForm}>
      <Tabs
        defaultActiveKey="login"
        centered
        items={[
          {
            key: 'login',
            label: '账号登录',
          },
        ]}
        className={styles.tabs}
      />

      <Form
        name="login"
        onFinish={onFinish}
        autoComplete="off"
        size="large"
        layout="vertical"
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input
            prefix={<UserOutlined className={styles.inputIcon} />}
            placeholder="用户名"
            className={styles.input}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined className={styles.inputIcon} />}
            placeholder="密码"
            className={styles.input}
          />
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

      <div className={styles.footer}>
        <span>还没有账号？</span>
        <Link to="/register" className={styles.link}>
          立即注册
        </Link>
      </div>
    </div>
  );
};

export default Login;
