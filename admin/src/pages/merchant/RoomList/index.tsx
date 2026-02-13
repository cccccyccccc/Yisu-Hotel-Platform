import { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, InputNumber, Upload,
  Empty, Popconfirm, Calendar, Tag, Select, Typography, Image, AutoComplete
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ArrowLeftOutlined, ReloadOutlined,
  CheckCircleFilled, InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

// API 引用
import { getRoomsByHotel, createRoom, updateRoom, deleteRoom, getRoomCalendar, updateRoomCalendar,type RoomType } from '@/api/rooms';
import { getHotelDetail } from '@/api/hotels';
import { uploadImage } from '@/api/upload';
import { getMerchantOrders, type Order } from '@/api/orders';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import type { Dayjs } from 'dayjs';

import styles from './RoomList.module.css';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Text } = Typography;

const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '元旦', '2026-02-17': '除夕', '2026-02-18': '春节',
  '2026-04-05': '清明', '2026-05-01': '五一', '2026-06-19': '端午',
  '2026-09-25': '中秋', '2026-10-01': '国庆',
};

const BED_TYPES = ['1.8m大床', '1.5m大床', '1.2m双床', '2.0m圆床', '榻榻米', '家庭房'];

interface CalendarItem {
  date: string;
  price: number;
  stock?: number;
}

const RoomList: React.FC = () => {
  const { hotelId } = useParams<{ hotelId: string }>();
  const navigate = useNavigate();
  
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotelName, setHotelName] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarRoom, setCalendarRoom] = useState<RoomType | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [basePrice, setBasePrice] = useState(0);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [priceForm] = Form.useForm();

  // 计算占用
  const getOccupiedCount = (roomId: string, dateStr: string) => {
    const targetDate = dayjs(dateStr);
    return orders.reduce((sum, order) => {
      if (order.roomTypeId._id !== roomId || order.status === 'cancelled') return sum;
      const checkIn = dayjs(order.checkInDate);
      const checkOut = dayjs(order.checkOutDate);
      if (targetDate.isSameOrAfter(checkIn, 'day') && targetDate.isBefore(checkOut, 'day')) {
        return sum + order.quantity;
      }
      return sum;
    }, 0);
  };

  const fetchData = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [roomsRes, hotelRes, ordersRes] = await Promise.all([
        getRoomsByHotel(hotelId),
        getHotelDetail(hotelId),
        getMerchantOrders()
      ]);
      setRooms(roomsRes.data);
      setHotelName(hotelRes.data.name);
      setOrders(ordersRes.data || []);
    } catch (error) {
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  // CRUD 操作
  const handleAdd = () => {
    setEditingRoom(null);
    setFileList([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: RoomType) => {
    setEditingRoom(record);
    form.setFieldsValue({ ...record });
    setFileList(
      record.images?.map((url, idx) => ({ uid: `-${idx}`, name: `img-${idx}`, status: 'done', url })) || []
    );
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoom(id);
      message.success('删除成功');
      setRooms(prev => prev.filter(r => r._id !== id));
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      const res = await uploadImage(file as File);
      onSuccess?.(res.data);
      setFileList(prev => [...prev, { uid: Date.now().toString(), name: 'img', status: 'done', url: res.data.url }]);
    } catch (e) { onError?.(e as Error); }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values, hotelId, images: fileList.map(f => f.url) };
      if (editingRoom) await updateRoom(editingRoom._id, payload);
      else await createRoom(payload);
      setModalVisible(false);
      fetchData();
      message.success('保存成功');
    } catch (e) { console.error(e); }
  };

  // 日历逻辑
  const handleOpenCalendar = async (record: RoomType) => {
    setCalendarRoom(record);
    setSelectedDates([]);
    priceForm.resetFields();
    setCalendarData([]);
    setBasePrice(record.price);
    setCalendarModalVisible(true);
    try {
      const res = await getRoomCalendar(record._id);
      setBasePrice(res.data.basePrice || record.price);
      setCalendarData(res.data.calendar || []);
    } catch (e) { console.log('No calendar data'); }
  };

  const onCalendarSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const newSelected = selectedDates.includes(dateStr) 
      ? selectedDates.filter(d => d !== dateStr) 
      : [...selectedDates, dateStr];
    setSelectedDates(newSelected);
  };

  const handleBatchSave = async () => {
    if (!selectedDates.length || !calendarRoom) return message.warning('请选择日期');
    try {
      const values = await priceForm.validateFields();
      const stockToSend = (values.dayStock === undefined || values.dayStock === null) 
        ? calendarRoom.stock 
        : values.dayStock;

      const updates = selectedDates.map(dateStr => ({
        date: dateStr,
        price: values.dayPrice,
        stock: stockToSend 
      }));

      await updateRoomCalendar(calendarRoom._id, updates);
      
      setCalendarData(prev => {
        const next = [...prev];
        updates.forEach(u => {
          const idx = next.findIndex(i => i.date === u.date);
          if (idx > -1) next[idx] = u;
          else next.push(u);
        });
        return next;
      });
      setSelectedDates([]);
      message.success('设置成功');
      fetchData(); // 刷新列表以更新首页显示的今日数据
    } catch (e) { message.error('保存失败'); }
  };

  const handleBatchReset = async () => {
    if (!selectedDates.length || !calendarRoom) return message.warning('请选择日期');
    try {
      const updates = selectedDates.map(dateStr => ({
        date: dateStr,
        price: basePrice,
        stock: calendarRoom.stock
      }));
      await updateRoomCalendar(calendarRoom._id, updates);
      setCalendarData(prev => prev.filter(i => !selectedDates.includes(i.date)));
      setSelectedDates([]);
      message.success('已恢复默认');
      fetchData(); // 刷新列表以更新首页显示的今日数据
    } catch (e) { message.error('重置失败'); }
  };

  // 日历渲染
  const dateCellRender = (value: Dayjs) => {
    if (!calendarRoom) return null;
    const dateStr = value.format('YYYY-MM-DD');
    const item = calendarData.find(c => c.date === dateStr);
    const isSelected = selectedDates.includes(dateStr);
    const holiday = HOLIDAYS[dateStr];

    const dailyTotalStock = item?.stock !== undefined ? item.stock : calendarRoom.stock;
    const occupied = getOccupiedCount(calendarRoom._id, dateStr);
    const remaining = dailyTotalStock - occupied;
    const finalRemaining = remaining < 0 ? 0 : remaining;
    const isPriceSpecial = item && item.price !== basePrice;

    return (
      <div className={`${styles.calendarCell} ${isSelected ? styles.selectedCell : ''}`}>
        <div className={styles.cellTop}>
          <span className={styles.dateNum}>{value.date()}</span>
          <div className={styles.topRightInfo}>
            {holiday && <Tag color="#f50" className={styles.holidayTag}>{holiday}</Tag>}
            {isSelected && <CheckCircleFilled className={styles.checkIcon} />}
          </div>
        </div>
        <div className={styles.cellContent}>
          <span className={isPriceSpecial ? styles.cellPrice : styles.defaultPrice}>
             ¥{item?.price ?? basePrice}
          </span>
          <div className={styles.cellStockRow}>
             <span className={finalRemaining < 3 ? styles.stockWarning : styles.stockNormal}>
               剩{finalRemaining}
             </span>
             {occupied > 0 && <span className={styles.occupiedInfo}>(订{occupied})</span>}
          </div>
        </div>
      </div>
    );
  };

  // --- 表格列定义 (修复今日数据不显示问题) ---
  const columns: ColumnsType<RoomType> = [
    {
      title: '房型信息',
      key: 'info',
      // 移除固定宽度，让其自适应占满剩余空间
      render: (_, record) => (
        <div className={styles.roomInfo}>
          <Image src={record.images?.[0] || 'err'} width={80} height={60} fallback="https://via.placeholder.com/80" style={{ borderRadius: 6, objectFit: 'cover' }} />
          <div>
            <div className={styles.roomTitle}>{record.title}</div>
            <Space size={4} style={{ marginTop: 4 }}>
               {record.size && <Tag className={styles.infoTag}>{record.size}m²</Tag>}
               {record.bedInfo && <Tag className={styles.infoTag}>{record.bedInfo}</Tag>}
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: '今日价格',
      key: 'price',
      width: 140,
      render: (_, record) => {
        // 核心修复：查找“今日”是否有特殊设置
        const todayStr = dayjs().format('YYYY-MM-DD');
        const todaySetting = record.priceCalendar?.find(c => c.date === todayStr);
        
        // 如果有特殊设置，显示特殊价格；否则显示基础价格
        const displayPrice = todaySetting ? todaySetting.price : record.price;
        const isSpecial = !!todaySetting && todaySetting.price !== record.price;

        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className={isSpecial ? styles.currPrice : styles.currPriceNormal}>
              ¥{displayPrice}
            </span>
            {isSpecial && <Text type="secondary" style={{ fontSize: 11 }}>已设特殊价</Text>}
            {!isSpecial && record.originalPrice && (
              <span className={styles.originalPrice}>¥{record.originalPrice}</span>
            )}
          </div>
        );
      },
    },
    {
      title: '今日库存情况',
      key: 'stock',
      width: 180,
      render: (_, record) => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        // 核心修复：查找“今日”是否有特殊库存设置
        const todaySetting = record.priceCalendar?.find(c => c.date === todayStr);
        
        // 今日总库存 = 日历设置库存 ?? 基础库存
        const todayTotalStock = todaySetting?.stock !== undefined ? todaySetting.stock : record.stock;
        
        const occupied = getOccupiedCount(record._id, todayStr);
        const remaining = todayTotalStock - occupied;
        
        return (
          <div className={styles.stockColumn}>
             <div className={styles.stockMain}>
                <span className={remaining < 3 ? styles.stockLow : styles.stockNormal}>
                   剩 {remaining < 0 ? 0 : remaining} 间
                </span>
                {remaining < 3 && <Tag color="error" style={{ transform: 'scale(0.8)' }}>紧张</Tag>}
             </div>
             <div className={styles.stockSub}>
                总 {todayTotalStock} / 已订 {occupied}
             </div>
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'right', // 按钮靠右更整齐
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleOpenCalendar(record)}>日历</Button>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record._id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
           <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} type="text" />
           <h2 className={styles.pageTitle}>{hotelName} - 房型管理</h2>
        </div>
        <Space>
           <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
           <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增房型</Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={rooms} 
        rowKey="_id" 
        loading={loading}
        pagination={false}
        // 确保表格不会被撑开太大，内容垂直居中
        style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
      />

      {/* 保持 Modal 部分不变 */}
      <Modal 
        title={editingRoom ? "编辑房型" : "新增房型"} 
        open={modalVisible} 
        onOk={handleModalOk} 
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
           <Form.Item name="title" label="房型名称" rules={[{ required: true }]}>
             <Input />
           </Form.Item>
           <Space>
             <Form.Item name="price" label="价格" rules={[{ required: true }]}>
                <InputNumber prefix="¥" style={{ width: 130 }} />
             </Form.Item>
             <Form.Item name="originalPrice" label="原价">
                <InputNumber prefix="¥" style={{ width: 130 }} />
             </Form.Item>
           </Space>
           <Space>
             <Form.Item name="stock" label="总物理库存" rules={[{ required: true }]} tooltip="该房型的房间总数">
                <InputNumber style={{ width: 130 }} placeholder="10" />
             </Form.Item>
             <Form.Item name="capacity" label="入住人数" rules={[{ required: true }]}>
                <InputNumber style={{ width: 130 }} suffix="人" />
             </Form.Item>
           </Space>
           <Space>
             <Form.Item name="bedInfo" label="床型" style={{ width: 200 }}>
               <AutoComplete options={BED_TYPES.map(v => ({ value: v }))} placeholder="选择或输入" />
             </Form.Item>
             <Form.Item name="size" label="面积">
               <Input suffix="m²" style={{ width: 130 }} />
             </Form.Item>
           </Space>
           <Form.Item label="图片">
             <Upload listType="picture-card" fileList={fileList} customRequest={handleUpload} onRemove={f => setFileList(p => p.filter(i => i.uid !== f.uid))}>
               {fileList.length < 5 && <div><PlusOutlined /><div>上传</div></div>}
             </Upload>
           </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<div>{calendarRoom?.title} - 价格库存日历 <Tag>基础价 ¥{basePrice}</Tag></div>}
        open={calendarModalVisible}
        onCancel={() => setCalendarModalVisible(false)}
        footer={null}
        width={850}
      >
        <div className={styles.calendarContainer}>
           <div className={styles.calendarToolbar}>
              <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 5 }} />
              <span>点击日期多选。选中2月13日后点击“恢复默认”即可清除特殊设置。</span>
           </div>
           
           <Calendar fullscreen={false} fullCellRender={dateCellRender} onSelect={onCalendarSelect} className={styles.customCalendar} />

           <div className={styles.batchSettings}>
              <div className={styles.batchTitle}>
                 批量设置 {selectedDates.length > 0 && <Tag color="blue">{selectedDates.length}天</Tag>}
              </div>
              <Form form={priceForm} layout="inline" disabled={selectedDates.length === 0}>
                 <Form.Item name="dayPrice" label="价格" rules={[{ required: true }]}>
                   <InputNumber prefix="¥" style={{ width: 100 }} placeholder={`${basePrice}`} />
                 </Form.Item>
                 <Form.Item name="dayStock" label="总库存">
                   <InputNumber style={{ width: 100 }} placeholder={`${calendarRoom?.stock}`} />
                 </Form.Item>
                 <Space>
                    <Button type="primary" onClick={handleBatchSave}>保存</Button>
                    <Button danger onClick={handleBatchReset}>恢复默认</Button>
                 </Space>
              </Form>
              <div className={styles.helpText}>* 点击“恢复默认”可清除选中日期的特殊价格，使其跟随全局设置</div>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoomList;