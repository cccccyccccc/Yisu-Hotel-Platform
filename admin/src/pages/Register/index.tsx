import { useState } from 'react';
import { Form, Input, Button, message, Radio } from 'antd';
import {
  UserOutlined, ShopOutlined, SafetyCertificateOutlined, CheckCircleFilled
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '@/api/auth';
import { AuthBackground, AuthHeader, PasswordInput } from '@/components/AuthShared';
import SliderCaptcha from '@/components/SliderCaptcha';
import styles from './Register.module.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'merchant' | 'admin'>('merchant');
  const [captchaToken, setCaptchaToken] = useState('');

  const onFinish = async (values: {
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    if (!captchaToken) {
      message.warning('请先完成滑块验证');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: values.username,
        password: values.password,
        role: selectedRole,
        captchaToken,
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
      <AuthBackground src="https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1920&q=80" styles={styles} />

      <div className={styles.glassPanel}>
        <AuthHeader styles={styles} extra={<h2 className={styles.formTitle}>创建账号</h2>} />

        <Form name="register" onFinish={onFinish} autoComplete="off" className={styles.form}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <div className={styles.inputWrapper}>
              <UserOutlined className={styles.inputIcon} />
              <Input placeholder="用户名" className={styles.glassInput} bordered={false} />
            </div>
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
            <PasswordInput placeholder="密码" styles={styles} />
          </Form.Item>

          <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认密码' }]}>
            <PasswordInput placeholder="确认密码" styles={styles} />
          </Form.Item>

          {/* 角色选择 */}
          <div className={styles.roleSection}>
            <label className={styles.roleLabel}>
              <span className={styles.required}>*</span>选择角色
            </label>
            <Radio.Group value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className={styles.roleGroup}>
              <div className={`${styles.roleCard} ${selectedRole === 'merchant' ? styles.roleCardActive : ''}`} onClick={() => setSelectedRole('merchant')}>
                <Radio value="merchant" className={styles.radioHidden} />
                <div className={styles.roleContent}>
                  <div className={styles.roleHeader}>
                    <ShopOutlined className={styles.roleIcon} />
                    <span className={styles.roleName}>商户</span>
                  </div>
                  <p className={styles.roleDesc}>可发布和管理酒店信息</p>
                </div>
                {selectedRole === 'merchant' && <CheckCircleFilled className={styles.checkIcon} />}
              </div>

              <div className={`${styles.roleCard} ${selectedRole === 'admin' ? styles.roleCardActive : ''}`} onClick={() => setSelectedRole('admin')}>
                <Radio value="admin" className={styles.radioHidden} />
                <div className={styles.roleContent}>
                  <div className={styles.roleHeader}>
                    <SafetyCertificateOutlined className={styles.roleIcon} />
                    <span className={styles.roleName}>管理员</span>
                  </div>
                  <p className={styles.roleDesc}>可审核和管理所有酒店</p>
                </div>
                {selectedRole === 'admin' && <CheckCircleFilled className={styles.checkIcon} />}
              </div>
            </Radio.Group>
          </div>

          {/* 滑块验证码 */}
          <SliderCaptcha onSuccess={(token) => setCaptchaToken(token)} />

          <Form.Item className={styles.submitItem}>
            <Button type="primary" htmlType="submit" loading={loading} disabled={!captchaToken} block className={styles.submitBtn}>
              注 册
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.footer}>
          <span>已有账号？</span>
          <Link to="/login" className={styles.link}>立即登录</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
