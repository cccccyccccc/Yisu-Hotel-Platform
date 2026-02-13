import { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, InputNumber, Switch,
  Tooltip, Empty, Image, Popconfirm, Upload
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons';
import { getBannerList, createBanner, updateBanner, deleteBanner } from '@/api/banners';
import { uploadImage } from '@/api/upload';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import styles from './BannerList.module.css';

// Banner 类型定义
interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  link?: string;
  sort: number;
  isActive: boolean;
}

const BannerList: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await getBannerList();
      setBanners(res.data || []);
    } catch (error: unknown) {
      // 如果是404或资源不存在，静默处理，设置为空数组
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        setBanners([]);
      } else {
        // 只有真正的网络错误才显示提示
        console.error('获取轮播图列表失败', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleAdd = () => {
    setEditingBanner(null);
    setFileList([]);
    form.resetFields();
    form.setFieldsValue({ sort: 0, isActive: true });
    setModalVisible(true);
  };

  const handleEdit = (record: Banner) => {
    setEditingBanner(record);
    form.setFieldsValue(record);
    setFileList([
      {
        uid: '-1',
        name: 'banner',
        status: 'done',
        url: record.imageUrl,
      },
    ]);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBanner(id);
      message.success('删除成功');
      fetchBanners();
    } catch {
      message.error('删除失败');
    }
  };

  const handleStatusChange = async (record: Banner, checked: boolean) => {
    try {
      await updateBanner(record._id, { isActive: checked });
      message.success(checked ? '已上线' : '已下线');
      fetchBanners();
    } catch {
      message.error('操作失败');
    }
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
      const res = await uploadImage(file as File);
      onSuccess?.(res.data);
      setFileList([
        {
          uid: Date.now().toString(),
          name: (file as File).name,
          status: 'done',
          url: res.data.url,
        },
      ]);
    } catch (err) {
      onError?.(err as Error);
      message.error('图片上传失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (fileList.length === 0) {
        message.warning('请上传轮播图');
        return;
      }

      const data = {
        ...values,
        imageUrl: fileList[0].url as string,
      };

      if (editingBanner) {
        await updateBanner(editingBanner._id, data);
        message.success('修改成功');
      } else {
        await createBanner(data);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchBanners();
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<Banner> = [
    {
      title: '预览',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 200,
      render: (url) => (
        <Image
          src={url}
          alt="banner"
          width={160}
          height={80}
          style={{ objectFit: 'cover', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '链接',
      dataIndex: 'link',
      key: 'link',
      ellipsis: true,
      render: (link) => link || '-',
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleStatusChange(record, checked)}
          checkedChildren="上线"
          unCheckedChildren="下线"
        />
      ),
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
            title="确定删除该轮播图？"
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
        <h2 className={styles.title}>轮播图管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchBanners}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className={styles.addBtn}
          >
            添加轮播图
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={banners}
        rowKey="_id"
        loading={loading}
        pagination={false}
        locale={{
          emptyText: (
            <Empty description="暂无轮播图" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={handleAdd}>
                添加轮播图
              </Button>
            </Empty>
          ),
        }}
      />

      <Modal
        title={editingBanner ? '编辑轮播图' : '添加轮播图'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={500}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="轮播图标题" />
          </Form.Item>
          <Form.Item label="轮播图片" required>
            <Upload
              listType="picture-card"
              fileList={fileList}
              customRequest={handleUpload}
              onRemove={() => setFileList([])}
              accept="image/*"
              maxCount={1}
            >
              {fileList.length === 0 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传图片</div>
                </div>
              )}
            </Upload>
            <p className={styles.uploadTip}>建议尺寸: 1200 x 400px</p>
          </Form.Item>
          <Form.Item name="link" label="跳转链接（可选）">
            <Input placeholder="点击轮播图跳转的链接" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="sort" label="排序">
              <InputNumber min={0} placeholder="0" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isActive" label="是否上线" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default BannerList;
