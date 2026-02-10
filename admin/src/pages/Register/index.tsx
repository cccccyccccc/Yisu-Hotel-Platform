import { useState } from 'react';
import { Form, Input, Button, message, Radio } from 'antd';
import {
  UserOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined,
  BankOutlined, ShopOutlined, SafetyCertificateOutlined, CheckCircleFilled
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '@/api/auth';
import styles from './Register.module.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'merchant' | 'admin'>('merchant');

  const onFinish = async (values: {
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: values.username,
        password: values.password,
        role: selectedRole,
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
    <div className={styles.container}>
      {/* 背景图片 */}
      <div className={styles.background}>
        <img
          src="https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1920&q=80"
          alt="Hotel Background"
          className={styles.bgImage}
        />
        <div className={styles.overlay} />
      </div>

      {/* 注册面板 */}
      <div className={styles.glassPanel}>
        {/* Logo 和标题 */}
        <div className={styles.header}>
          <div className={styles.logoBox}>
            <BankOutlined className={styles.logoIcon} />
          </div>
          <h1 className={styles.title}>易宿酒店平台</h1>
          <p className={styles.subtitle}>Yisu Hotel Platform</p>
          <h2 className={styles.formTitle}>创建账号</h2>
        </div>

        {/* 注册表单 */}
        <Form
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          className={styles.form}
        >
          {/* 用户名 */}
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <div className={styles.inputWrapper}>
              <UserOutlined className={styles.inputIcon} />
              <Input
                placeholder="用户名"
                className={styles.glassInput}
                bordered={false}
              />
            </div>
          </Form.Item>

          {/* 密码 */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <div className={styles.inputWrapper}>
              <LockOutlined className={styles.inputIcon} />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="密码"
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

          {/* 确认密码 */}
          <Form.Item
            name="confirmPassword"
            rules={[{ required: true, message: '请确认密码' }]}
          >
            <div className={styles.inputWrapper}>
              <LockOutlined className={styles.inputIcon} />
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="确认密码"
                className={styles.glassInput}
                bordered={false}
              />
              <span
                className={styles.eyeIcon}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              </span>
            </div>
          </Form.Item>

          {/* 角色选择 */}
          <div className={styles.roleSection}>
            <label className={styles.roleLabel}>
              <span className={styles.required}>*</span>选择角色
            </label>
            <Radio.Group
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={styles.roleGroup}
            >
              {/* 商户选项 */}
              <div
                className={`${styles.roleCard} ${selectedRole === 'merchant' ? styles.roleCardActive : ''}`}
                onClick={() => setSelectedRole('merchant')}
              >
                <Radio value="merchant" className={styles.radioHidden} />
                <div className={styles.roleContent}>
                  <div className={styles.roleHeader}>
                    <ShopOutlined className={styles.roleIcon} />
                    <span className={styles.roleName}>商户</span>
                  </div>
                  <p className={styles.roleDesc}>可发布和管理酒店信息</p>
                </div>
                {selectedRole === 'merchant' && (
                  <CheckCircleFilled className={styles.checkIcon} />
                )}
              </div>

              {/* 管理员选项 */}
              <div
                className={`${styles.roleCard} ${selectedRole === 'admin' ? styles.roleCardActive : ''}`}
                onClick={() => setSelectedRole('admin')}
              >
                <Radio value="admin" className={styles.radioHidden} />
                <div className={styles.roleContent}>
                  <div className={styles.roleHeader}>
                    <SafetyCertificateOutlined className={styles.roleIcon} />
                    <span className={styles.roleName}>管理员</span>
                  </div>
                  <p className={styles.roleDesc}>可审核和管理所有酒店</p>
                </div>
                {selectedRole === 'admin' && (
                  <CheckCircleFilled className={styles.checkIcon} />
                )}
              </div>
            </Radio.Group>
          </div>

          {/* 注册按钮 */}
          <Form.Item className={styles.submitItem}>
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

        {/* 登录链接 */}
        <div className={styles.footer}>
          <span>已有账号？</span>
          <Link to="/login" className={styles.link}>
            立即登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
