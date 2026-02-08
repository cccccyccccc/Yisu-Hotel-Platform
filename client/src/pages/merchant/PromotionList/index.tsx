import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Space, Tag, Popconfirm, message, Switch, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, PercentageOutlined
} from '@ant-design/icons';
import { getMyPromotions, createPromotion, updatePromotion, deletePromotion, formatDiscount } from '@/api/promotions';
import type { Promotion } from '@/api/promotions';
import { getMerchantHotels } from '@/api/merchant';
import { getHotelRoomTypes } from '@/api/rooms';
import dayjs from 'dayjs';
import styles from './PromotionList.module.css';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface Hotel {
  _id: string;
  name: string;
}

interface RoomType {
  _id: string;
  title: string;
}

const PromotionList: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [form] = Form.useForm();

  // 获取促销列表
  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await getMyPromotions();
      setPromotions(res.data);
    } catch (error) {
      message.error('获取促销列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取酒店列表
  const fetchHotels = async () => {
    try {
      const res = await getMerchantHotels();
      setHotels(res.data);
    } catch {
      // 静默失败
    }
  };

  // 获取房型列表
  const handleHotelChange = async (hotelId: string) => {
    try {
      const res = await getHotelRoomTypes(hotelId);
      setRoomTypes(res.data);
    } catch {
      setRoomTypes([]);
    }
  };

  useEffect(() => {
    fetchPromotions();
    fetchHotels();
  }, []);

  // 打开创建/编辑弹窗
  const handleOpenModal = (promotion?: Promotion) => {
    if (promotion) {
      setEditingPromotion(promotion);
      const hotelId = typeof promotion.hotelId === 'object' ? promotion.hotelId._id : promotion.hotelId;
      handleHotelChange(hotelId);
      form.setFieldsValue({
        hotelId,
        title: promotion.title,
        description: promotion.description,
        type: promotion.type,
        discountValue: promotion.type === 'discount' ? promotion.discountValue * 10 : promotion.discountValue,
        minAmount: promotion.minAmount,
        roomTypes: Array.isArray(promotion.roomTypes)
          ? promotion.roomTypes.map(r => typeof r === 'object' ? r._id : r)
          : [],
        dateRange: [dayjs(promotion.startDate), dayjs(promotion.endDate)],
        status: promotion.status === 1
      });
    } else {
      setEditingPromotion(null);
      form.resetFields();
      setRoomTypes([]);
    }
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        hotelId: values.hotelId,
        title: values.title,
        description: values.description,
        type: values.type,
        discountValue: values.type === 'discount' ? values.discountValue / 10 : values.discountValue,
        minAmount: values.minAmount || 0,
        roomTypes: values.roomTypes || [],
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        status: values.status ? 1 : 0
      };

      if (editingPromotion) {
        await updatePromotion(editingPromotion._id, data);
        message.success('促销更新成功');
      } else {
        await createPromotion(data);
        message.success('促销创建成功');
      }

      setModalVisible(false);
      fetchPromotions();
    } catch (error) {
      // 表单验证失败
    }
  };

  // 删除促销
  const handleDelete = async (id: string) => {
    try {
      await deletePromotion(id);
      message.success('促销已删除');
      fetchPromotions();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 快速切换状态
  const handleToggleStatus = async (promotion: Promotion) => {
    try {
      await updatePromotion(promotion._id, { status: promotion.status === 1 ? 0 : 1 });
      message.success('状态已更新');
      fetchPromotions();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '酒店',
      dataIndex: 'hotelId',
      key: 'hotel',
      render: (hotel: { name: string } | string) =>
        typeof hotel === 'object' ? hotel.name : hotel,
    },
    {
      title: '促销名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '优惠内容',
      key: 'discount',
      render: (_: unknown, record: Promotion) => (
        <Tag color="red" icon={<GiftOutlined />}>
          {formatDiscount(record)}
        </Tag>
      ),
    },
    {
      title: '适用房型',
      dataIndex: 'roomTypes',
      key: 'roomTypes',
      render: (roomTypes: { title: string }[] | string[]) => {
        if (!roomTypes || roomTypes.length === 0) {
          return <Text type="secondary">全部房型</Text>;
        }
        return roomTypes.map((r, i) => (
          <Tag key={i}>{typeof r === 'object' ? r.title : r}</Tag>
        ));
      },
    },
    {
      title: '有效期',
      key: 'period',
      render: (_: unknown, record: Promotion) => (
        <span>
          {dayjs(record.startDate).format('MM-DD')} ~ {dayjs(record.endDate).format('MM-DD')}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number, record: Promotion) => (
        <Switch
          checked={status === 1}
          checkedChildren="上线"
          unCheckedChildren="下线"
          onChange={() => handleToggleStatus(record)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Promotion) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此促销活动？"
            onConfirm={() => handleDelete(record._id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <Card
        title={
          <span>
            <PercentageOutlined /> 促销活动管理
          </span>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            创建促销
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={promotions}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingPromotion ? '编辑促销' : '创建促销'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ status: true }}>
          <Form.Item
            name="hotelId"
            label="选择酒店"
            rules={[{ required: true, message: '请选择酒店' }]}
          >
            <Select
              placeholder="请选择酒店"
              options={hotels.map(h => ({ value: h._id, label: h.name }))}
              onChange={handleHotelChange}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="促销名称"
            rules={[{ required: true, message: '请输入促销名称' }]}
          >
            <Input placeholder="如：国庆特惠、周末狂欢" maxLength={50} />
          </Form.Item>

          <Form.Item name="description" label="促销描述">
            <Input.TextArea placeholder="可选，描述促销详情" maxLength={200} rows={2} />
          </Form.Item>

          <Form.Item
            name="type"
            label="优惠类型"
            rules={[{ required: true, message: '请选择优惠类型' }]}
          >
            <Select
              placeholder="请选择优惠类型"
              options={[
                { value: 'discount', label: '折扣 (如8折)' },
                { value: 'amount_off', label: '满减 (如满500减50)' },
                { value: 'fixed_price', label: '特价 (固定价格)' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'discount') {
                return (
                  <Form.Item
                    name="discountValue"
                    label="折扣力度"
                    rules={[{ required: true, message: '请输入折扣' }]}
                  >
                    <InputNumber
                      min={1}
                      max={9.9}
                      step={0.5}
                      precision={1}
                      addonAfter="折"
                      placeholder="如 8 表示8折"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                );
              }
              if (type === 'amount_off') {
                return (
                  <>
                    <Form.Item
                      name="minAmount"
                      label="满减门槛"
                      rules={[{ required: true, message: '请输入门槛金额' }]}
                    >
                      <InputNumber
                        min={0}
                        addonBefore="满"
                        addonAfter="元"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="discountValue"
                      label="减免金额"
                      rules={[{ required: true, message: '请输入减免金额' }]}
                    >
                      <InputNumber
                        min={1}
                        addonBefore="减"
                        addonAfter="元"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </>
                );
              }
              if (type === 'fixed_price') {
                return (
                  <Form.Item
                    name="discountValue"
                    label="特价金额"
                    rules={[{ required: true, message: '请输入特价金额' }]}
                  >
                    <InputNumber
                      min={1}
                      addonBefore="¥"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="roomTypes" label="适用房型">
            <Select
              mode="multiple"
              placeholder="留空表示适用所有房型"
              options={roomTypes.map(r => ({ value: r._id, label: r.title }))}
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="有效期"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="status" label="上线状态" valuePropName="checked">
            <Switch checkedChildren="上线" unCheckedChildren="下线" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PromotionList;
