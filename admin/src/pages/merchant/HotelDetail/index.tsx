import React, { useEffect, useState } from 'react';
import {
  Button, Card, Tabs, Tag, Table, Input, Avatar, Rate,
  Space, Badge, Modal, message, Empty, Image, Form, InputNumber, Row, Col
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  EnvironmentOutlined, StarOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined, MessageOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

// === API Imports ===
// 注意：如果你的 api/hotels.ts 没有 deleteHotel，请添加或者使用下面的下线逻辑
import { getHotelDetail, updateHotel, updateHotelStatus, type Hotel } from '@/api/hotels';
import { getHotelReviews, replyToReview, type Review } from '@/api/reviews';
import { getRoomsByHotel, createRoom, updateRoom, deleteRoom, type RoomType } from '@/api/rooms';
import { getMerchantOrders, type Order } from '@/api/orders';

import styles from './HotelDetail.module.css';


const { TextArea } = Input;

// 🟢 配置图片服务器地址 (根据你的后端端口修改，如 http://localhost:3000)
const SERVER_URL = 'http://localhost:5000';

const HotelDetail: React.FC = () => {
  const { hotelId } = useParams<{ hotelId: string }>();
  const navigate = useNavigate();

  // Forms
  const [formHotel] = Form.useForm();
  const [formRoom] = Form.useForm();
  const [formBatch] = Form.useForm();
  const [formReply] = Form.useForm();

  // Loading States
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  // Data States
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // UI States
  const [isHotelModalVisible, setIsHotelModalVisible] = useState(false);
  const [isRoomModalVisible, setIsRoomModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);

  // Batch & Reply States
  const [selectedRoomKeys, setSelectedRoomKeys] = useState<React.Key[]>([]);
  const [isBatchModalVisible, setIsBatchModalVisible] = useState(false);
  const [isReplyModalVisible, setIsReplyModalVisible] = useState(false);
  const [currentReviewId, setCurrentReviewId] = useState<string>('');

  // 🟢 工具函数：处理图片路径
  const getImageUrl = (url?: string) => {
    if (!url) return 'https://via.placeholder.com/200x150?text=No+Image';
    if (url.startsWith('http')) return url;
    return `${SERVER_URL}${url} `;
  };

  // 初始化数据
  const fetchData = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [hotelRes, reviewsRes] = await Promise.all([
        getHotelDetail(hotelId),
        getHotelReviews(hotelId)
      ]);
      setHotel(hotelRes.data);
      setReviews(reviewsRes.data || []);

      // 并行获取子数据
      fetchRooms();
      fetchOrders();
    } catch (error) {
      console.error(error);
      message.error('获取酒店详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    if (!hotelId) return;
    setRoomLoading(true);
    try {
      const res = await getRoomsByHotel(hotelId);
      setRooms(res.data || []);
    } catch {
      message.error('获取房型失败');
    } finally {
      setRoomLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!hotelId) return;
    setOrderLoading(true);
    try {
      const res = await getMerchantOrders();
      // 🟢 前端过滤：只显示当前酒店的订单
      // 兼容处理：API返回的 hotelId 可能是对象也可能是字符串
      const currentHotelOrders = (res.data || []).filter((order: Order) => {
        const orderHotelId = typeof order.hotelId === 'string' ? order.hotelId : order.hotelId?._id;
        return orderHotelId === hotelId;
      });
      setOrders(currentHotelOrders);
    } catch (error) {
      console.error('获取订单失败', error);
    } finally {
      setOrderLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  // ================= 1. 酒店操作 (编辑/删除) =================

  const handleEditHotel = () => {
    if (hotel) {
      // 处理回填数据，注意 location 等复杂字段可能需要特殊处理，这里回填基础字段
      formHotel.setFieldsValue({
        ...hotel,
        tags: hotel.tags?.join(',') // 假设输入框是逗号分隔字符串，或者 Tag Select
      });
      setIsHotelModalVisible(true);
    }
  };

  const submitEditHotel = async () => {
    try {
      const values = await formHotel.validateFields();
      if (!hotelId) return;

      // 数据格式转换 (如 tags 字符串转数组)
      const submitData = {
        ...values,
        tags: typeof values.tags === 'string' ? values.tags.split(',') : values.tags
      };

      await updateHotel(hotelId, submitData);
      message.success('酒店信息更新成功');
      setIsHotelModalVisible(false);
      fetchData(); // 刷新
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteHotel = () => {
    Modal.confirm({
      title: '确认下架该酒店?',
      icon: <ExclamationCircleOutlined />,
      content: '下架后用户将无法检索到该酒店。',
      okText: '确认下架',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (!hotelId) return;
          // 🟢 使用 updateHotelStatus 将状态改为 3 (下线)
          // 如果你实现了 deleteHotel 接口，这里可以换成 deleteHotel(hotelId)
          await updateHotelStatus(hotelId, 3);
          message.success('酒店已下架');
          navigate('/merchant/hotels');
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  // ================= 2. 房型操作 (新增/编辑/批量改价) =================

  const handleEditRoom = (room?: RoomType) => {
    setEditingRoom(room || null);
    if (room) {
      formRoom.setFieldsValue(room);
    } else {
      formRoom.resetFields();
    }
    setIsRoomModalVisible(true);
  };

  const submitRoom = async () => {
    try {
      const values = await formRoom.validateFields();
      if (editingRoom) {
        await updateRoom(editingRoom._id, values);
        message.success('房型更新成功');
      } else {
        if (!hotelId) return;
        await createRoom({ ...values, hotelId });
        message.success('房型创建成功');
      }
      setIsRoomModalVisible(false);
      fetchRooms();
    } catch {
      message.error('操作失败');
    }
  };

  const handleBatchPrice = () => {
    if (selectedRoomKeys.length === 0) {
      message.warning('请先勾选需要改价的房型');
      return;
    }
    formBatch.resetFields();
    setIsBatchModalVisible(true);
  };

  const submitBatchPrice = async () => {
    try {
      const { price } = await formBatch.validateFields();
      // 并发请求
      const promises = selectedRoomKeys.map(id =>
        updateRoom(id as string, { price })
      );
      await Promise.all(promises);
      message.success(`已更新 ${selectedRoomKeys.length} 个房型的价格`);
      setIsBatchModalVisible(false);
      setSelectedRoomKeys([]);
      fetchRooms();
    } catch {
      message.error('批量更新失败');
    }
  };

  const handleDeleteRoom = (id: string) => {
    Modal.confirm({
      title: '确认删除房型?',
      content: '删除后无法恢复。',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteRoom(id);
          message.success('删除成功');
          fetchRooms();
        } catch {
          message.error('删除失败');
        }
      }
    });
  };

  // ================= 3. 评价回复 =================

  const handleReplyClick = (reviewId: string) => {
    setCurrentReviewId(reviewId);
    formReply.resetFields();
    setIsReplyModalVisible(true);
  };

  const submitReply = async () => {
    try {
      const { content } = await formReply.validateFields();
      await replyToReview(currentReviewId, content);
      message.success('回复成功');
      setIsReplyModalVisible(false);
      // 刷新评论列表 (可能需要重新 fetch)
      const res = await getHotelReviews(hotelId!);
      setReviews(res.data);
    } catch {
      message.error('回复失败');
    }
  };

  // ================= 4. Columns 配置 =================

  const roomColumns = [
    {
      title: '图片',
      dataIndex: 'images',
      render: (images: string[]) => (
        <Image
          src={getImageUrl(images?.[0])}
          width={60}
          height={45}
          style={{ objectFit: 'cover', borderRadius: 4 }}
        />
      )
    },
    {
      title: '房型名称',
      dataIndex: 'title',
      render: (text: string, record: RoomType) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {record.bedInfo} | {record.size} | {record.capacity}人
          </div>
        </div>
      )
    },
    {
      title: '价格',
      dataIndex: 'price',
      render: (val: number) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>¥{val}</span>
    },
    {
      title: '库存',
      dataIndex: 'stock',
      render: (val: number) => val > 0 ? <Tag color="success">{val}间</Tag> : <Tag color="error">满房</Tag>
    },
    {
      title: '操作',
      render: (_: unknown, record: RoomType) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEditRoom(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteRoom(record._id)}>删除</Button>
        </Space>
      )
    }
  ];

  const orderColumns = [
    { title: '订单号', dataIndex: '_id', render: (id: string) => `#${id.slice(-6).toUpperCase()} ` },
    { title: '房型', dataIndex: ['roomTypeId', 'title'] },
    {
      title: '入住信息',
      render: (_: unknown, r: Order) => (
        <div>
          <div>{r.userId?.username}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {dayjs(r.checkInDate).format('MM/DD')} - {dayjs(r.checkOutDate).format('MM/DD')}
          </div>
        </div>
      )
    },
    { title: '金额', dataIndex: 'totalPrice', render: (v: number) => `¥${v} ` },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: any = { pending: 'default', paid: 'processing', completed: 'success', cancelled: 'error' };
        const labelMap: Record<string, string> = { pending: '待支付', paid: '已支付', completed: '已完成', cancelled: '已取消' };
        return <Badge status={map[status]} text={labelMap[status] || status} />;
      }
    },
  ];

  // Tab Contents
  const tabItems = [
    {
      key: '1',
      label: '房型管理',
      children: (
        <>
          <div className={styles.tableToolbar} style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditRoom()}>新增房型</Button>
              <Button onClick={handleBatchPrice}>批量改价</Button>
            </Space>
          </div>
          <Table
            rowSelection={{
              type: 'checkbox',
              onChange: (keys) => setSelectedRoomKeys(keys),
              selectedRowKeys: selectedRoomKeys
            }}
            loading={roomLoading}
            columns={roomColumns}
            dataSource={rooms}
            rowKey="_id"
            pagination={{ pageSize: 5 }}
          />
        </>
      )
    },
    {
      key: '2',
      label: '订单记录',
      children: (
        <Table
          loading={orderLoading}
          columns={orderColumns}
          dataSource={orders}
          rowKey="_id"
        />
      )
    },
    {
      key: '3',
      label: `评价管理(${reviews.length})`,
      children: reviews.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map(review => (
            <Card key={review._id} size="small" className={styles.reviewCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                  <Avatar src={review.userId?.avatar}>{review.userId?.username?.[0]}</Avatar>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{review.userId?.username}</div>
                    <Rate disabled value={review.rating} style={{ fontSize: 12 }} />
                  </div>
                </Space>
                <span style={{ color: '#999', fontSize: 12 }}>
                  {dayjs(review.createdAt).format('YYYY-MM-DD')}
                </span>
              </div>
              <div style={{ marginTop: 12, color: '#333' }}>{review.content}</div>
              {/* 回复按钮区域 */}
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Button size="small" icon={<MessageOutlined />} onClick={() => handleReplyClick(review._id)}>
                  回复
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : <Empty description="暂无评价" />
    }
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.topBar}>
        <div className={styles.headerLeft}>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/merchant/hotels')} className={styles.backBtn}>返回</Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className={styles.title} style={{ margin: 0 }}>{hotel?.name}</h2>
            {hotel?.status === 0 && <Tag color="orange">待审核</Tag>}
            {hotel?.status === 1 && <Tag color="green">已发布</Tag>}
            {hotel?.status === 2 && <Tag color="red">已拒绝</Tag>}
            {hotel?.status === 3 && <Tag color="default">已下线</Tag>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button danger icon={<DeleteOutlined />} onClick={handleDeleteHotel}>下架/删除</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={handleEditHotel}>编辑资料</Button>
        </div>
      </div>

      {/* Overview */}
      <Card className={styles.overviewCard} loading={loading}>
        <div style={{ display: 'flex', gap: 24 }}>
          <Image
            width={240}
            height={180}
            src={getImageUrl(hotel?.images?.[0])}
            style={{ objectFit: 'cover', borderRadius: 8 }}
            fallback="https://via.placeholder.com/240x180?text=No+Image"
          />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>{hotel?.nameEn || hotel?.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#666' }}>
              <span><EnvironmentOutlined /> {hotel?.city} {hotel?.address}</span>
              <span><StarOutlined /> {hotel?.starRating} 星级</span>
              <span><InfoCircleOutlined /> {hotel?.description || '暂无简介'}</span>
            </div>
            <div style={{ marginTop: 16 }}>
              {hotel?.tags?.map(tag => <Tag key={tag} color="blue">{tag}</Tag>)}
            </div>
          </div>
          {/* Stats */}
          <div style={{ width: 200, borderLeft: '1px solid #f0f0f0', paddingLeft: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#888', fontSize: 12 }}>总订单</div>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{orders.length}</div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: 12 }}>房型数量</div>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{rooms.length}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Tabs */}
      <Card style={{ marginTop: 24 }} className={styles.tabsCard}>
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>

      {/* --- Modals --- */}

      {/* 1. Edit Hotel Modal */}
      <Modal
        title="编辑酒店资料"
        open={isHotelModalVisible}
        onOk={submitEditHotel}
        onCancel={() => setIsHotelModalVisible(false)}
      >
        <Form form={formHotel} layout="vertical">
          <Form.Item name="name" label="酒店名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="详细地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="price" label="起步价">
            <InputNumber prefix="¥" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="starRating" label="星级">
            <Rate />
          </Form.Item>
          <Form.Item name="tags" label="标签 (逗号分隔)">
            {/* 简单实现，这里用 Input，提交时转数组 */}
            <Input placeholder="免费停车,健身房" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 2. Room Modal */}
      <Modal
        title={editingRoom ? "编辑房型" : "新增房型"}
        open={isRoomModalVisible}
        onOk={submitRoom}
        onCancel={() => setIsRoomModalVisible(false)}
      >
        <Form form={formRoom} layout="vertical">
          <Form.Item name="title" label="房型名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price" label="价格" rules={[{ required: true }]}>
                <InputNumber prefix="¥" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stock" label="库存" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="bedInfo" label="床型信息">
            <Input placeholder="例如：1.8m大床" />
          </Form.Item>
          <Form.Item name="capacity" label="可住人数">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 3. Batch Price Modal */}
      <Modal
        title="批量修改价格"
        open={isBatchModalVisible}
        onOk={submitBatchPrice}
        onCancel={() => setIsBatchModalVisible(false)}
      >
        <p>即将修改 {selectedRoomKeys.length} 个房型的价格</p>
        <Form form={formBatch} layout="vertical">
          <Form.Item name="price" label="新价格" rules={[{ required: true }]}>
            <InputNumber prefix="¥" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 4. Reply Modal */}
      <Modal
        title="回复评价"
        open={isReplyModalVisible}
        onOk={submitReply}
        onCancel={() => setIsReplyModalVisible(false)}
      >
        <Form form={formReply}>
          <Form.Item name="content" rules={[{ required: true, message: '请输入回复内容' }]}>
            <TextArea rows={4} placeholder="请输入您的回复..." />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default HotelDetail;