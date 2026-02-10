import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Avatar, Upload, Radio, message, Spin, Row, Col, List, Tag, Modal, Empty } from 'antd';
import {
  UserOutlined, CameraOutlined, SaveOutlined,
  LockOutlined, SafetyCertificateOutlined, ClockCircleOutlined,
  BellOutlined, InfoCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { getUserProfile, updateUserProfile, changePassword } from '@/api/users';
import { getAnnouncements, getAnnouncementDetail } from '@/api/announcements';
import type { AnnouncementListItem, Announcement } from '@/api/announcements';
import { uploadImage } from '@/api/upload';
import type { UploadProps } from 'antd/es/upload';
import { useUserStore } from '@/stores';
import styles from './Profile.module.css';

interface UserProfile {
  _id: string;
  username: string;
  role: string;
  gender?: string;
  avatar?: string;
  bio?: string;
  createdAt?: string;
}

const Profile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [form] = Form.useForm();

  // 公告相关状态
  const [announcements, setAnnouncements] = useState<AnnouncementListItem[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [announcementDetail, setAnnouncementDetail] = useState<Announcement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 密码修改相关状态
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchProfile();
    fetchAnnouncements();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await getUserProfile();
      setProfile(res.data);
      setAvatarUrl(res.data.avatar || '');
      form.setFieldsValue({
        gender: res.data.gender || 'unknown',
        bio: res.data.bio || '',
      });
    } catch (error) {
      message.error('获取个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await getAnnouncements();
      setAnnouncements(res.data);
    } catch (error) {
      // 静默处理，不影响页面显示
      console.error('获取公告失败', error);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailModalVisible(true);
    try {
      const res = await getAnnouncementDetail(id);
      setAnnouncementDetail(res.data);
    } catch (error) {
      message.error('获取公告详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
      const res = await uploadImage(file as File);
      setAvatarUrl(res.data.url);
      onSuccess?.(res.data);
      message.success('头像上传成功');
    } catch (error) {
      onError?.(error as Error);
      message.error('头像上传失败');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await updateUserProfile({
        ...values,
        avatar: avatarUrl,
      });
      // 更新全局 Store 以同步侧边栏头像
      useUserStore.getState().updateUser({
        avatar: avatarUrl,
        gender: values.gender,
        bio: values.bio,
      });
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的新密码不一致');
        return;
      }
      setPasswordLoading(true);
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      message.error(err.response?.data?.msg || '密码修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'merchant':
        return '商户';
      case 'admin':
        return '管理员';
      default:
        return '用户';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getNotificationTag = (type: string) => {
    switch (type) {
      case 'success':
        return <Tag icon={<CheckCircleOutlined />} color="success">更新</Tag>;
      case 'warning':
        return <Tag icon={<ExclamationCircleOutlined />} color="warning">提醒</Tag>;
      default:
        return <Tag icon={<InfoCircleOutlined />} color="processing">通知</Tag>;
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>个人设置</h1>
        <p className={styles.subtitle}>管理您的账户信息</p>
      </div>

      <Row gutter={24}>
        {/* 左侧：个人资料表单 */}
        <Col xs={24} lg={14}>
          <Card className={styles.profileCard}>
            <div className={styles.avatarSection}>
              <Upload
                name="avatar"
                showUploadList={false}
                customRequest={handleAvatarUpload}
                accept="image/*"
              >
                <div className={styles.avatarWrapper}>
                  <Avatar
                    size={100}
                    src={avatarUrl}
                    icon={<UserOutlined />}
                    className={styles.avatar}
                  />
                  <div className={styles.avatarOverlay}>
                    <CameraOutlined />
                  </div>
                </div>
              </Upload>
              <div className={styles.userInfo}>
                <h2 className={styles.username}>{profile?.username}</h2>
                <span className={styles.role}>{getRoleText(profile?.role || '')}</span>
              </div>
            </div>

            <Form form={form} layout="vertical" className={styles.form}>
              <Form.Item label="用户名">
                <Input value={profile?.username} disabled />
              </Form.Item>

              <Form.Item label="角色">
                <Input value={getRoleText(profile?.role || '')} disabled />
              </Form.Item>

              <Form.Item name="gender" label="性别">
                <Radio.Group>
                  <Radio value="male">男</Radio>
                  <Radio value="female">女</Radio>
                  <Radio value="unknown">保密</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="bio" label="个人简介">
                <Input.TextArea
                  rows={4}
                  placeholder="介绍一下自己..."
                  maxLength={200}
                  showCount
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size="large"
                  onClick={handleSave}
                  loading={saving}
                  className={styles.saveBtn}
                >
                  保存修改
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右侧：账户安全 + 系统通知 */}
        <Col xs={24} lg={10}>
          {/* 账户安全卡片 */}
          <Card
            className={styles.securityCard}
            title={
              <span className={styles.cardTitle}>
                <SafetyCertificateOutlined /> 账户安全
              </span>
            }
          >
            <div className={styles.securityItem}>
              <div className={styles.securityIcon}>
                <LockOutlined />
              </div>
              <div className={styles.securityInfo}>
                <div className={styles.securityLabel}>登录密码</div>
                <div className={styles.securityValue}>已设置</div>
              </div>
              <Button type="link" className={styles.securityAction} onClick={() => setPasswordModalVisible(true)}>
                修改
              </Button>
            </div>

            <div className={styles.securityItem}>
              <div className={styles.securityIcon}>
                <ClockCircleOutlined />
              </div>
              <div className={styles.securityInfo}>
                <div className={styles.securityLabel}>账户创建时间</div>
                <div className={styles.securityValue}>{formatDate(profile?.createdAt)}</div>
              </div>
            </div>

            <div className={styles.securityItem}>
              <div className={styles.securityIcon}>
                <InfoCircleOutlined />
              </div>
              <div className={styles.securityInfo}>
                <div className={styles.securityLabel}>账户ID</div>
                <div className={styles.securityValue}>{profile?._id?.slice(-8) || '-'}</div>
              </div>
            </div>
          </Card>

          {/* 系统通知卡片 */}
          <Card
            className={styles.notificationCard}
            title={
              <span className={styles.cardTitle}>
                <BellOutlined /> 系统通知
              </span>
            }
          >
            {announcements.length > 0 ? (
              <List
                dataSource={announcements}
                renderItem={(item) => (
                  <List.Item
                    className={styles.notificationItem}
                    onClick={() => handleViewDetail(item._id)}
                  >
                    <div className={styles.notificationContent}>
                      {getNotificationTag(item.type)}
                      <span className={styles.notificationText}>{item.title}</span>
                    </div>
                    <span className={styles.notificationTime}>{formatTime(item.createdAt)}</span>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 公告详情弹窗 */}
      <Modal
        title={
          announcementDetail && (
            <span>
              {getNotificationTag(announcementDetail.type)}
              <span style={{ marginLeft: 8 }}>{announcementDetail.title}</span>
            </span>
          )
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : announcementDetail ? (
          <div className={styles.detailContent}>
            <div className={styles.detailMeta}>
              发布时间：{formatDate(announcementDetail.createdAt)}
            </div>
            <div className={styles.detailBody}>
              {announcementDetail.content}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        onOk={handlePasswordChange}
        confirmLoading={passwordLoading}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="oldPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile;
