import { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, InputNumber, Upload,
  Tooltip, Empty, Popconfirm
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ArrowLeftOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getRoomsByHotel, createRoom, updateRoom, deleteRoom } from '@/api/rooms';
import { getHotelDetail } from '@/api/hotels';
import { uploadImage } from '@/api/upload';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import styles from './RoomList.module.css';

// 房型类型定义
interface RoomType {
  _id: string;
  hotelId: string;
  title: string;
  price: number;
  originalPrice?: number;
  capacity: number;
  bedInfo?: string;
  size?: string;
  stock: number;
  images?: string[];
}

const RoomList: React.FC = () => {
  const { hotelId } = useParams<{ hotelId: string }>();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotelName, setHotelName] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const fetchRooms = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const res = await getRoomsByHotel(hotelId);
      setRooms(res.data);
    } catch (error) {
      message.error('获取房型列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchHotelInfo = async () => {
    if (!hotelId) return;
    try {
      const res = await getHotelDetail(hotelId);
      setHotelName(res.data.name);
    } catch (error) {
      message.error('获取酒店信息失败');
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchHotelInfo();
  }, [hotelId]);

  const handleAdd = () => {
    setEditingRoom(null);
    setFileList([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: RoomType) => {
    setEditingRoom(record);
    form.setFieldsValue(record);
    setFileList(
      record.images?.map((url, idx) => ({
        uid: `-${idx}`,
        name: `image-${idx}`,
        status: 'done' as const,
        url,
      })) || []
    );
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoom(id);
      message.success('删除成功');
      fetchRooms();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
      const res = await uploadImage(file as File);
      onSuccess?.(res.data);
      setFileList((prev) => [
        ...prev,
        {
          uid: Date.now().toString(),
          name: (file as File).name,
          status: 'done',
          url: res.data.url,
        },
      ]);
    } catch (error) {
      onError?.(error as Error);
      message.error('图片上传失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        hotelId,
        images: fileList.map((f) => f.url as string),
      };

      if (editingRoom) {
        await updateRoom(editingRoom._id, data);
        message.success('修改成功');
      } else {
        await createRoom(data);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchRooms();
    } catch (error) {
      console.error(error);
    }
  };

  const columns: ColumnsType<RoomType> = [
    {
      title: '房型名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (val, record) => (
        <div>
          <span className={styles.price}>¥{val}</span>
          {record.originalPrice && (
            <span className={styles.originalPrice}>¥{record.originalPrice}</span>
          )}
        </div>
      ),
    },
    {
      title: '容纳人数',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 100,
      render: (val) => `${val}人`,
    },
    {
      title: '床型',
      dataIndex: 'bedInfo',
      key: 'bedInfo',
      width: 150,
    },
    {
      title: '面积',
      dataIndex: 'size',
      key: 'size',
      width: 100,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
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
            title="确定删除该房型？"
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
        <div className={styles.headerLeft}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/merchant/hotels')}
          >
            返回
          </Button>
          <h2 className={styles.title}>
            {hotelName} - 房型管理
          </h2>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRooms}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className={styles.addBtn}
          >
            添加房型
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={rooms}
        rowKey="_id"
        loading={loading}
        pagination={false}
        locale={{
          emptyText: (
            <Empty description="暂无房型" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={handleAdd}>
                添加房型
              </Button>
            </Empty>
          ),
        }}
      />

      <Modal
        title={editingRoom ? '编辑房型' : '添加房型'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="房型名称"
            rules={[{ required: true, message: '请输入房型名称' }]}
          >
            <Input placeholder="如：豪华大床房" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="price"
              label="房间价格"
              rules={[{ required: true, message: '请输入价格' }]}
            >
              <InputNumber min={0} prefix="¥" placeholder="368" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="originalPrice" label="原价（可选）">
              <InputNumber min={0} prefix="¥" placeholder="原价" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="capacity"
              label="容纳人数"
              rules={[{ required: true, message: '请输入容纳人数' }]}
            >
              <InputNumber min={1} max={10} placeholder="2" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item
              name="stock"
              label="库存数量"
              rules={[{ required: true, message: '请输入库存' }]}
            >
              <InputNumber min={0} placeholder="10" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="bedInfo" label="床型信息">
              <Input placeholder="如：1.8米大床" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="size" label="房间面积">
              <Input placeholder="如：35m²" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Form.Item label="房型图片">
            <Upload
              listType="picture-card"
              fileList={fileList}
              customRequest={handleUpload}
              onRemove={(file) =>
                setFileList((prev) => prev.filter((f) => f.uid !== file.uid))
              }
              accept="image/*"
            >
              {fileList.length < 5 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RoomList;
