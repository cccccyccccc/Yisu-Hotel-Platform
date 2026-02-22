import { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, InputNumber, Switch,
  Tooltip, Empty, Image, Popconfirm, Upload, Select
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons';
import { getBannerList, createBanner, updateBanner, deleteBanner } from '@/api/banners';
import { uploadImage } from '@/api/upload';
import { getAdminHotelList, type Hotel } from '@/api/hotels'; // 引入真实的酒店 API 和类型
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import styles from './BannerList.module.css';

// Banner 类型定义
interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  link?: string; // 后端返回的拼接链接，如 /hotels/xxx
  targetHotelId?: string; // 真实的酒店 ID，用于表单提交
  sort: number;
  isActive: boolean;
}

const BannerList: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]); // 存放真实的酒店列表
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  // 获取轮播图列表
  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await getBannerList();
      const data = res.data || res || []; 
      setBanners(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        setBanners([]);
      } else {
        console.error('获取轮播图列表失败', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // 获取酒店列表供下拉框使用
  const fetchHotels = async () => {
    try {
      // 调用传入的真实接口
      const res = await getAdminHotelList(); 
      // 兼容请求拦截器的不同返回层级
      const data = (res as any).data || res || [];
      if (Array.isArray(data)) {
        setHotels(data);
      }
    } catch (error) {
      console.error('获取酒店列表失败', error);
      message.error('获取可选酒店列表失败');
    }
  };

  useEffect(() => {
    fetchBanners();
    fetchHotels(); // 页面加载时请求一次酒店列表
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
    
    // 自动从后端返回的 link ("/hotels/xxx") 中提取真实的 24 位 ID
    const extractedHotelId = record.link ? record.link.split('/').pop() : undefined;

    form.setFieldsValue({
      ...record,
      targetHotelId: extractedHotelId
    });
    
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
      message.error('操作状态失败');
    }
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
      const res = await uploadImage(file as File);
      const imgUrl = res.data.url; 
      onSuccess?.(res.data);
      setFileList([
        {
          uid: Date.now().toString(),
          name: (file as File).name,
          status: 'done',
          url: imgUrl,
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

      const imageUrl = fileList[0].url as string;

      if (editingBanner) {
        const updateData = {
          title: values.title,
          imageUrl: imageUrl,
          sort: values.sort,
          isActive: values.isActive
        };
        await updateBanner(editingBanner._id, updateData);
        message.success('修改成功');
      } else {
        const createData = {
          title: values.title,
          imageUrl: imageUrl,
          priority: values.sort, // 重点：将表单的 sort 映射为后端的 priority
          targetHotelId: values.targetHotelId || undefined, // 避免传空字符串导致 MongoDB 报错
          isActive: values.isActive
        };
        await createBanner(createData);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchBanners();
    } catch (error) {
      console.error('表单校验失败或请求失败:', error);
    }
  };

  const columns: ColumnsType<Banner> = [
    {
      title: '预览',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 200,
      render: (url) => (
        <Image src={url} alt="banner" width={160} height={80} style={{ objectFit: 'cover', borderRadius: 8 }} />
      ),
    },
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '跳转链接',
      dataIndex: 'link',
      key: 'link',
      ellipsis: true,
      render: (link) => link ? <a href={link} target="_blank" rel="noreferrer">{link}</a> : '-',
    },
    { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive, record) => (
        <Switch checked={isActive} onChange={(checked) => handleStatusChange(record, checked)} checkedChildren="上线" unCheckedChildren="下线" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除该轮播图？" onConfirm={() => handleDelete(record._id)} okText="确定" cancelText="取消">
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
          <Button icon={<ReloadOutlined />} onClick={fetchBanners}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} className={styles.addBtn}>
            添加轮播图
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={banners} rowKey="_id" loading={loading} pagination={false} />

      <Modal
        title={editingBanner ? '编辑轮播图' : '添加轮播图'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={500}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
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
              {fileList.length === 0 && (<div><PlusOutlined /><div style={{ marginTop: 8 }}>上传图片</div></div>)}
            </Upload>
            <p className={styles.uploadTip}>建议尺寸: 1200 x 400px</p>
          </Form.Item>

          {/* 使用选择框代替手填 ID，用户体验大幅度提升 */}
          <Form.Item 
            name="targetHotelId" 
            label="关联酒店 (选填)" 
            tooltip={editingBanner ? "提示：当前后端接口暂不支持修改已创建轮播图的酒店" : "选择点击轮播图后跳转的酒店"}
          >
            <Select
              showSearch
              allowClear
              placeholder="请搜索并选择酒店"
              disabled={!!editingBanner}
              optionFilterProp="label" // 配置支持按照名称搜索
              options={hotels.map(hotel => ({
                value: hotel._id,     // 后端需要的 24位 ID
                label: hotel.name,    // 前端展示的名称
              }))}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="sort" label="排序权重">
              <InputNumber min={0} placeholder="0" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isActive" label="是否上线" valuePropName="checked">
              <Switch checkedChildren="上线" unCheckedChildren="下线" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default BannerList;