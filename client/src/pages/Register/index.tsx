import { useState } from 'react';
import { Form, Input, Button, message, Radio, Space } from 'antd';
import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '@/api/auth';
import styles from './Register.module.css';

interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
  role: 'merchant' | 'admin';
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: RegisterFormData) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次密码输入不一致');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: values.username,
        password: values.password,
        role: values.role,
      });
      message.success('注册成功！请登录');
      navigate('/login');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      message.error(err.response?.data?.msg || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.registerForm}>
      <h2 className={styles.formTitle}>创建账号</h2>

      <Form
        form={form}
        name="register"
        onFinish={onFinish}
        autoComplete="off"
        size="large"
        layout="vertical"
        initialValues={{ role: 'merchant' }}
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined className={styles.inputIcon} />}
            placeholder="用户名"
            className={styles.input}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className={styles.inputIcon} />}
            placeholder="密码"
            className={styles.input}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className={styles.inputIcon} />}
            placeholder="确认密码"
            className={styles.input}
          />
        </Form.Item>

        <Form.Item
          name="role"
          label={<span className={styles.roleLabel}>选择角色</span>}
          rules={[{ required: true, message: '请选择角色' }]}
        >
          <Radio.Group className={styles.roleGroup}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio.Button value="merchant" className={styles.roleBtn}>
                <IdcardOutlined /> 商户
                <span className={styles.roleDesc}>可发布和管理酒店信息</span>
              </Radio.Button>
              <Radio.Button value="admin" className={styles.roleBtn}>
                <IdcardOutlined /> 管理员
                <span className={styles.roleDesc}>可审核和管理所有酒店</span>
              </Radio.Button>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className={styles.submitBtn}
          >
            注 册
          </Button>
        </Form.Item>
      </Form>

      <div className={styles.footer}>
        <span>已有账号？</span>
        <Link to="/login" className={styles.link}>
          立即登录
        </Link>
      </div>
    </div>
  );
};

export default Register;
