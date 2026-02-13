import { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, Select, Tag,
  Tooltip, Empty, Popconfirm, Switch
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  NotificationOutlined, InfoCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import {
  getAdminAnnouncementList, createAnnouncement, updateAnnouncement, deleteAnnouncement
} from '@/api/announcements';
import type { Announcement } from '@/api/announcements';
import type { ColumnsType } from 'antd/es/table';
import styles from './AnnouncementList.module.css';

const { TextArea } = Input;
const { Option } = Select;

const AnnouncementList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getAdminAnnouncementList();
      setAnnouncements(res.data);
    } catch {
      message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ type: 'info', status: true });
    setModalVisible(true);
  };

  const handleEdit = (record: Announcement) => {
    setEditingItem(record);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      type: record.type,
      status: record.status === 1,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      message.success('删除成功');
      fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        status: values.status ? 1 : 0,
      };

      if (editingItem) {
        await updateAnnouncement(editingItem._id, data);
        message.success('更新成功');
      } else {
        await createAnnouncement(data);
        message.success('发布成功');
      }
      setModalVisible(false);
      fetchList();
    } catch {
      // validation error
    }
  };

  const getTypeTag = (type: string) => {
    switch (type) {
      case 'success':
        return <Tag icon={<CheckCircleOutlined />} color="success">更新</Tag>;
      case 'warning':
        return <Tag icon={<ExclamationCircleOutlined />} color="warning">提醒</Tag>;
      default:
        return <Tag icon={<InfoCircleOutlined />} color="processing">通知</Tag>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  const columns: ColumnsType<Announcement> = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: getTypeTag,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val) => (
        <Tag color={val === 1 ? 'green' : 'default'}>
          {val === 1 ? '上线' : '下线'}
        </Tag>
      ),
    },
    {
      title: '发布者',
      dataIndex: ['createdBy', 'username'],
      key: 'createdBy',
      width: 100,
    },
    {
      title: '发布时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: formatDate,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除该公告？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>公告管理</h1>
          <p className={styles.subtitle}>管理系统公告，发布平台通知</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className={styles.addBtn}
          >
            发布公告
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={announcements}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条`,
        }}
        locale={{
          emptyText: (
            <Empty description="暂无公告" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={handleAdd}>发布公告</Button>
            </Empty>
          ),
        }}
      />

      {/* 添加/编辑公告弹窗 */}
      <Modal
        title={
          <span>
            <NotificationOutlined style={{ marginRight: 8 }} />
            {editingItem ? '编辑公告' : '发布公告'}
          </span>
        }
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="公告标题"
            rules={[{ required: true, message: '请输入公告标题' }]}
          >
            <Input placeholder="请输入公告标题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item
            name="type"
            label="公告类型"
            rules={[{ required: true, message: '请选择公告类型' }]}
          >
            <Select>
              <Option value="info">
                <Tag color="processing">通知</Tag> 一般通知信息
              </Option>
              <Option value="success">
                <Tag color="success">更新</Tag> 系统更新公告
              </Option>
              <Option value="warning">
                <Tag color="warning">提醒</Tag> 重要提醒
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="公告内容"
            rules={[{ required: true, message: '请输入公告内容' }]}
          >
            <TextArea
              rows={6}
              placeholder="请输入公告详细内容..."
              maxLength={5000}
              showCount
            />
          </Form.Item>

          <Form.Item name="status" label="发布状态" valuePropName="checked">
            <Switch checkedChildren="上线" unCheckedChildren="下线" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementList;
