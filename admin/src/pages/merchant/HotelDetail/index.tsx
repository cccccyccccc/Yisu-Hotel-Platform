import React, { useEffect, useState, useRef } from 'react';
import {
  Button, Card, Tabs, Tag, Table, Input, Avatar, Rate,
  Space, Badge, Modal, message, Empty, Image, Form, InputNumber, Row, Col,
  Upload, Cascader, DatePicker, Select, AutoComplete, Popconfirm, Calendar, Typography
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  EnvironmentOutlined, StarOutlined, InfoCircleOutlined,
  ExclamationCircleOutlined, MessageOutlined, ReloadOutlined,
  CheckCircleFilled, SearchOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import AMapLoader from '@amap/amap-jsapi-loader';

// === API Imports ===
import { getHotelDetail, updateHotel, updateHotelStatus, type Hotel } from '@/api/hotels';
import { getHotelReviews, replyToReview, type Review } from '@/api/reviews';
import { 
  getRoomsByHotel, createRoom, updateRoom, deleteRoom, 
  getRoomCalendar, updateRoomCalendar, type RoomType 
} from '@/api/rooms';
import { getMerchantOrders, type Order } from '@/api/orders';
import { uploadImage } from '@/api/upload';

// === Data/Utils Imports ===
// 请确保你有这个文件，或者在代码下方模拟一个 provinceCityData
import { provinceCityData, findProvinceByCity } from '@/data/cities'; 
import type { UploadFile, UploadProps, RcFile } from 'antd/es/upload';

import styles from './HotelDetail.module.css'; // 请确保合并了 RoomList 和 HotelEdit 的 CSS

// 扩展 dayjs
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { TextArea } = Input;
const { Text } = Typography;

// 🟢 配置
const SERVER_URL = 'http://localhost:5000';
const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '元旦', '2026-02-17': '除夕', '2026-02-18': '春节',
  '2026-05-01': '五一', '2026-10-01': '国庆',
};
const BED_TYPES = ['1.8m大床', '1.5m大床', '1.2m双床', '2.0m圆床', '榻榻米', '家庭房'];

// 高德地图安全密钥 (建议移至全局配置)
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)._AMapSecurityConfig = {
    securityJsCode: '77c23574261c938c6d74008344c60ff1', // 替换你的安全密钥
  };
}

interface CalendarItem {
  date: string;
  price: number;
  stock?: number;
}

const HotelDetail: React.FC = () => {
  const { hotelId } = useParams<{ hotelId: string }>();
  const navigate = useNavigate();

  // Forms
  const [formHotel] = Form.useForm();
  const [formRoom] = Form.useForm();
  const [formReply] = Form.useForm();
  const [formCalendar] = Form.useForm();

  // Loading States
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  // Data States
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // UI States - Modals
  const [isHotelModalVisible, setIsHotelModalVisible] = useState(false);
  const [isRoomModalVisible, setIsRoomModalVisible] = useState(false);
  const [isReplyModalVisible, setIsReplyModalVisible] = useState(false);
  const [isCalendarModalVisible, setIsCalendarModalVisible] = useState(false);

  // Logic States - Hotel Edit
  const [hotelFileList, setHotelFileList] = useState<UploadFile[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const geocoder = useRef<any>(null);

  // Logic States - Room Edit
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);
  const [roomFileList, setRoomFileList] = useState<UploadFile[]>([]);
  
  // Logic States - Calendar
  const [calendarRoom, setCalendarRoom] = useState<RoomType | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [basePrice, setBasePrice] = useState(0);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  
  // Logic States - Reply
  const [currentReviewId, setCurrentReviewId] = useState<string>('');

  // 🟢 工具函数
  const getImageUrl = (url?: string) => {
    if (!url) return 'https://via.placeholder.com/200x150?text=No+Image';
    if (url.startsWith('http')) return url;
    return `${SERVER_URL}${url}`;
  };

  const getOccupiedCount = (roomId: string, dateStr: string) => {
    const targetDate = dayjs(dateStr);
    return orders.reduce((sum, order) => {
      // 兼容处理 order.hotelId 和 order.roomTypeId
      const rId = typeof order.roomTypeId === 'string' ? order.roomTypeId : order.roomTypeId?._id;
      if (rId !== roomId || order.status === 'cancelled') return sum;
      
      const checkIn = dayjs(order.checkInDate);
      const checkOut = dayjs(order.checkOutDate);
      if (targetDate.isSameOrAfter(checkIn, 'day') && targetDate.isBefore(checkOut, 'day')) {
        return sum + order.quantity;
      }
      return sum;
    }, 0);
  };

  // ================= 1. 初始化数据 =================
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

  // ================= 2. 酒店编辑逻辑 (融合 HotelEdit) =================

  // 初始化地图
  const initMap = (AMap: any) => {
    if (!mapRef.current) return;
    // 如果已有实例，先销毁（防止二次打开弹窗报错）
    if (mapInstance.current) {
        mapInstance.current.destroy();
    }

    const initialCenter = hotel?.location?.coordinates || [116.4074, 39.9042];
    
    mapInstance.current = new AMap.Map(mapRef.current, {
      zoom: 13,
      center: initialCenter,
    });
    geocoder.current = new AMap.Geocoder();
    markerInstance.current = new AMap.Marker({ 
      draggable: true, 
      position: initialCenter 
    });
    mapInstance.current.add(markerInstance.current);

    // 拖拽标记更新表单
    markerInstance.current.on('dragend', (e: any) => {
        const lnglat = [e.lnglat.lng, e.lnglat.lat];
        updateLocationInfo(lnglat as [number, number]);
    });
    
    // 点击地图更新标记
    mapInstance.current.on('click', (e: any) => {
        const lnglat = [e.lnglat.lng, e.lnglat.lat];
        markerInstance.current.setPosition(lnglat);
        updateLocationInfo(lnglat as [number, number]);
    });
  };

  const updateLocationInfo = (lnglat: [number, number]) => {
    // 这里只更新 form 的 location 字段，显示地址需要 geocoder
    geocoder.current?.getAddress(lnglat, (status: string, result: any) => {
      if (status === 'complete' && result.regeocode) {
        const { addressComponent, formattedAddress } = result.regeocode;
        formHotel.setFieldValue('address', formattedAddress);
        // 尝试自动匹配城市
        const city = addressComponent.city || addressComponent.district;
        // 注意：这里可能需要根据你的 provinceCityData 结构来匹配
        formHotel.setFieldValue('city', [addressComponent.province, city]); 
      }
    });
  };

  const handleEditHotel = () => {
    if (!hotel) return;
    setIsHotelModalVisible(true);

    // 表单回填
    formHotel.setFieldsValue({
      ...hotel,
      city: hotel.city ? findProvinceByCity(hotel.city) || [hotel.city] : [], // 需自行实现 findProvinceByCity
      openingTime: hotel.openingTime ? dayjs(hotel.openingTime, 'YYYY') : null,
      starRating: Number(hotel.starRating)
    });

    // 图片回填
    if (hotel.images) {
      const files = hotel.images.map((url, idx) => ({
        uid: `-${idx}`,
        name: `image-${idx}`,
        status: 'done',
        url: getImageUrl(url),
        response: { url } // 保留原始相对路径
      }));
      setHotelFileList(files as UploadFile[]);
    }

    // 延迟加载地图，确保 Modal DOM 已渲染
    setTimeout(() => {
        AMapLoader.load({
            key: '14cf2ac7198b687730a69d24057f58de', // 替换你的 Key
            version: '2.0',
            plugins: ['AMap.Geocoder', 'AMap.Geolocation'],
        }).then((AMap) => {
            initMap(AMap);
        }).catch(e => console.error("地图加载失败:", e));
    }, 100);
  };

  const submitEditHotel = async () => {
    try {
      const values = await formHotel.validateFields();
      if (!hotelId) return;

      // 处理图片路径
      const processImages = hotelFileList.map(f => {
        if (f.response?.url) return f.response.url; // 已经是相对路径
        if (f.url) return f.url?.replace(SERVER_URL, ''); // 绝对转相对
        return null;
      }).filter(Boolean);

      // 处理坐标
      const coordinates = markerInstance.current 
        ? markerInstance.current.getPosition().toArray() 
        : (hotel?.location?.coordinates || [116.4074, 39.9042]);

      const submitData = {
        ...values,
        starRating: Number(values.starRating),
        city: Array.isArray(values.city) ? values.city[values.city.length - 1] : values.city,
        openingTime: values.openingTime?.format('YYYY'),
        location: { type: 'Point', coordinates },
        images: processImages
      };

      await updateHotel(hotelId, submitData);
      message.success('酒店信息更新成功');
      setIsHotelModalVisible(false);
      fetchData(); 
    } catch (e) {
      console.error(e);
      message.error('更新失败');
    }
  };

  const handleUploadHotel: UploadProps['customRequest'] = async ({ file, onSuccess }) => {
    try {
      const res = await uploadImage(file as File);
      onSuccess?.(res.data);
      setHotelFileList(prev => [...prev, { 
        uid: Date.now().toString(), 
        name: 'img', 
        status: 'done', 
        url: getImageUrl(res.data.url),
        response: { url: res.data.url }
      }]);
    } catch { message.error('上传失败'); }
  };

  const handleDeleteHotel = () => {
    Modal.confirm({
      title: '确认下架该酒店?',
      icon: <ExclamationCircleOutlined />,
      content: '下架后用户将无法检索到该酒店。',
      okText: '确认下架',
      okType: 'danger',
      onOk: async () => {
        try {
            if (hotelId) {
                await updateHotelStatus(hotelId, 3);
                message.success('酒店已下架');
                navigate('/merchant/hotels');
            }
        } catch { message.error('操作失败'); }
      },
    });
  };

  // ================= 3. 房型列表与编辑 (融合 RoomList) =================

  const handleEditRoom = (room?: RoomType) => {
    setEditingRoom(room || null);
    if (room) {
      formRoom.setFieldsValue(room);
      setRoomFileList(
        room.images?.map((url, idx) => ({ 
            uid: `-${idx}`, name: `img-${idx}`, status: 'done', 
            url: getImageUrl(url), response: { url }
        })) || []
      );
    } else {
      formRoom.resetFields();
      setRoomFileList([]);
    }
    setIsRoomModalVisible(true);
  };

  const submitRoom = async () => {
    try {
      const values = await formRoom.validateFields();
      // 图片处理
      const images = roomFileList.map(f => {
        return f.response?.url || f.url?.replace(SERVER_URL, '');
      }).filter(Boolean);

      const payload = { ...values, hotelId, images };

      if (editingRoom) {
        await updateRoom(editingRoom._id, payload);
        message.success('房型更新成功');
      } else {
        if (!hotelId) return;
        await createRoom(payload);
        message.success('房型创建成功');
      }
      setIsRoomModalVisible(false);
      fetchRooms();
    } catch {
      message.error('操作失败');
    }
  };

  const handleUploadRoom: UploadProps['customRequest'] = async ({ file, onSuccess }) => {
    try {
      const res = await uploadImage(file as File);
      onSuccess?.(res.data);
      setRoomFileList(prev => [...prev, { 
        uid: Date.now().toString(), name: 'img', status: 'done', 
        url: getImageUrl(res.data.url), response: { url: res.data.url }
      }]);
    } catch { message.error('上传失败'); }
  };

  const handleDeleteRoom = (id: string) => {
    try {
        deleteRoom(id).then(() => {
            message.success('删除成功');
            fetchRooms();
        });
    } catch { message.error('删除失败'); }
  };

  // ================= 4. 房型日历逻辑 =================

  const handleOpenCalendar = async (record: RoomType) => {
    setCalendarRoom(record);
    setSelectedDates([]);
    formCalendar.resetFields();
    setCalendarData([]);
    setBasePrice(record.price);
    setIsCalendarModalVisible(true);
    try {
      const res = await getRoomCalendar(record._id);
      setBasePrice(res.data.basePrice || record.price);
      setCalendarData(res.data.calendar || []);
    } catch { console.log('No calendar data'); }
  };

  const onCalendarSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const newSelected = selectedDates.includes(dateStr)
      ? selectedDates.filter(d => d !== dateStr)
      : [...selectedDates, dateStr];
    setSelectedDates(newSelected);
  };

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
          </div>
        </div>
      </div>
    );
  };

  const handleBatchSaveCalendar = async () => {
    if (!selectedDates.length || !calendarRoom) return message.warning('请选择日期');
    try {
      const values = await formCalendar.validateFields();
      const stockToSend = (values.dayStock === undefined || values.dayStock === null)
        ? calendarRoom.stock
        : values.dayStock;

      const updates = selectedDates.map(dateStr => ({
        date: dateStr,
        price: values.dayPrice,
        stock: stockToSend
      }));

      await updateRoomCalendar(calendarRoom._id, updates);
      
      // 更新本地数据，避免频繁刷新
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
      fetchRooms(); // 刷新外层列表
    } catch { message.error('保存失败'); }
  };

  const handleBatchResetCalendar = async () => {
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
      fetchRooms();
    } catch { message.error('重置失败'); }
  };


  // ================= 5. 表格列配置 =================

  const roomColumns = [
    {
      title: '房型信息',
      key: 'info',
      render: (_: unknown, record: RoomType) => (
        <div className={styles.roomInfo} style={{ display: 'flex', gap: 12 }}>
          <Image 
            src={getImageUrl(record.images?.[0])} 
            width={80} height={60} 
            style={{ borderRadius: 6, objectFit: 'cover' }} 
            fallback="https://via.placeholder.com/80"
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{record.title}</div>
            <Space size={4} style={{ marginTop: 4 }}>
              {record.size && <Tag>{record.size}m²</Tag>}
              {record.bedInfo && <Tag>{record.bedInfo}</Tag>}
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: '今日价格',
      key: 'price',
      width: 140,
      render: (_: unknown, record: RoomType) => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const todaySetting = record.priceCalendar?.find(c => c.date === todayStr);
        const displayPrice = todaySetting ? todaySetting.price : record.price;
        const isSpecial = !!todaySetting && todaySetting.price !== record.price;

        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: isSpecial ? '#f5222d' : '#333', fontWeight: 'bold', fontSize: 16 }}>
              ¥{displayPrice}
            </span>
            {isSpecial && <Text type="secondary" style={{ fontSize: 11 }}>已设特殊价</Text>}
            {!isSpecial && record.originalPrice && (
              <span style={{ textDecoration: 'line-through', color: '#999', fontSize: 12 }}>¥{record.originalPrice}</span>
            )}
          </div>
        );
      },
    },
    {
      title: '今日库存',
      key: 'stock',
      width: 180,
      render: (_: unknown, record: RoomType) => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const todaySetting = record.priceCalendar?.find(c => c.date === todayStr);
        const todayTotalStock = todaySetting?.stock !== undefined ? todaySetting.stock : record.stock;
        const occupied = getOccupiedCount(record._id, todayStr);
        const remaining = todayTotalStock - occupied;

        return (
          <div>
            <div style={{ color: remaining < 3 ? '#ff4d4f' : '#333', fontWeight: 'bold' }}>
              剩 {remaining < 0 ? 0 : remaining} 间
              {remaining < 3 && <Tag color="error" style={{ marginLeft: 6, transform: 'scale(0.8)' }}>紧张</Tag>}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              总 {todayTotalStock} / 已订 {occupied}
            </div>
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: RoomType) => (
        <Space size="small">
          <Button type="primary" ghost size="small" onClick={() => handleOpenCalendar(record)}>日历</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditRoom(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeleteRoom(record._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const orderColumns = [
    { title: '订单号', dataIndex: '_id', render: (id: string) => `#${id.slice(-6).toUpperCase()}` },
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
    { title: '金额', dataIndex: 'totalPrice', render: (v: number) => `¥${v}` },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: any = { pending: 'default', paid: 'processing', completed: 'success', cancelled: 'error' };
        return <Badge status={map[status]} text={status} />;
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
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
             <Space>
               <Button icon={<ReloadOutlined />} onClick={fetchRooms}>刷新</Button>
               <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditRoom()}>新增房型</Button>
             </Space>
          </div>
          <Table
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
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Button size="small" icon={<MessageOutlined />} onClick={() => {
                    setCurrentReviewId(review._id);
                    formReply.resetFields();
                    setIsReplyModalVisible(true);
                }}>
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
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/merchant/hotels')} style={{ marginRight: 8 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className={styles.title} style={{ margin: 0 }}>{hotel?.name}</h2>
            {hotel?.status === 0 && <Tag color="orange">待审核</Tag>}
            {hotel?.status === 1 && <Tag color="green">已发布</Tag>}
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

      <Card style={{ marginTop: 24 }} className={styles.tabsCard}>
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>

      {/* --- Modals --- */}

      {/* 1. 复杂酒店编辑弹窗 (集成高德地图) */}
      <Modal
        title="编辑酒店资料"
        open={isHotelModalVisible}
        onOk={submitEditHotel}
        onCancel={() => setIsHotelModalVisible(false)}
        width={900}
        style={{ top: 20 }}
      >
        <Form form={formHotel} layout="vertical">
            <Row gutter={24}>
                <Col span={14}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="name" label="酒店名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="nameEn" label="英文名称"><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item name="tags" label="标签"><Select mode="tags" /></Form.Item>
                    <Row gutter={16}>
                        <Col span={10}>
                           {/* 需自行确保 provinceCityData 存在 */}
                           <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                               <Cascader options={provinceCityData} placeholder="选择城市" />
                           </Form.Item>
                        </Col>
                        <Col span={14}>
                            <Form.Item name="address" label="地址" rules={[{ required: true }]}>
                                <Input suffix={<SearchOutlined />} placeholder="输入详细地址" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="starRating" label="星级">
                                <Select>{[1,2,3,4,5].map(s=><Select.Option key={s} value={s}>{s}星</Select.Option>)}</Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}><Form.Item name="price" label="起步价"><InputNumber prefix="¥" style={{width:'100%'}} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="openingTime" label="开业年份"><DatePicker picker="year" style={{width:'100%'}}/></Form.Item></Col>
                    </Row>
                    <Form.Item name="description" label="简介"><TextArea rows={3} /></Form.Item>
                    
                    <Form.Item label="酒店图片 (最多10张)">
                        <Upload 
                            listType="picture-card" 
                            fileList={hotelFileList} 
                            customRequest={handleUploadHotel}
                            onRemove={(file) => setHotelFileList(prev => prev.filter(i => i.uid !== file.uid))}
                        >
                           {hotelFileList.length < 10 && <div><PlusOutlined /><div>上传</div></div>}
                        </Upload>
                    </Form.Item>
                </Col>
                <Col span={10}>
                    <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>* 拖动红色标记或点击地图可修正位置</div>
                    <div ref={mapRef} style={{ height: 400, width: '100%', background: '#f0f2f5', borderRadius: 8 }} />
                    <div style={{ marginTop: 16 }}>
                       <Form.Item name="nearbyAttractions" label="附近景点"><Select mode="tags" /></Form.Item>
                       <Form.Item name="nearbyTransport" label="交通信息"><Select mode="tags" /></Form.Item>
                    </div>
                </Col>
            </Row>
        </Form>
      </Modal>

      {/* 2. 复杂房型编辑弹窗 */}
      <Modal
        title={editingRoom ? "编辑房型" : "新增房型"}
        open={isRoomModalVisible}
        onOk={submitRoom}
        onCancel={() => setIsRoomModalVisible(false)}
        width={600}
      >
        <Form form={formRoom} layout="vertical">
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
            <Form.Item name="stock" label="总物理库存" rules={[{ required: true }]}>
              <InputNumber style={{ width: 130 }} />
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
          <Form.Item label="房型图片">
            <Upload 
                listType="picture-card" 
                fileList={roomFileList} 
                customRequest={handleUploadRoom} 
                onRemove={f => setRoomFileList(p => p.filter(i => i.uid !== f.uid))}
            >
              {roomFileList.length < 5 && <div><PlusOutlined /><div>上传</div></div>}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 3. 价格库存日历弹窗 */}
      <Modal
        title={<div>{calendarRoom?.title} - 价格库存日历 <Tag>基础价 ¥{basePrice}</Tag></div>}
        open={isCalendarModalVisible}
        onCancel={() => setIsCalendarModalVisible(false)}
        footer={null}
        width={850}
      >
        <div className={styles.calendarContainer}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', color: '#666' }}>
            <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 5 }} />
            <span>点击日期可多选。选中后下方可批量设置。</span>
          </div>

          <Calendar 
            fullscreen={false} 
            fullCellRender={dateCellRender} 
            onSelect={onCalendarSelect} 
            className={styles.customCalendar} 
          />

          <div style={{ background: '#f5f5f5', padding: 16, marginTop: 16, borderRadius: 8 }}>
            <div style={{ marginBottom: 12, fontWeight: 'bold' }}>
              批量设置 {selectedDates.length > 0 && <Tag color="blue">{selectedDates.length}天</Tag>}
            </div>
            <Form form={formCalendar} layout="inline" disabled={selectedDates.length === 0}>
              <Form.Item name="dayPrice" label="价格" rules={[{ required: true }]}>
                <InputNumber prefix="¥" style={{ width: 100 }} placeholder={`${basePrice}`} />
              </Form.Item>
              <Form.Item name="dayStock" label="总库存">
                <InputNumber style={{ width: 100 }} placeholder={`${calendarRoom?.stock}`} />
              </Form.Item>
              <Space>
                <Button type="primary" onClick={handleBatchSaveCalendar}>保存</Button>
                <Button danger onClick={handleBatchResetCalendar}>恢复默认</Button>
              </Space>
            </Form>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>* 点击“恢复默认”可清除选中日期的特殊价格，使其跟随全局设置</div>
          </div>
        </div>
      </Modal>

      {/* 4. 回复评价弹窗 */}
      <Modal
        title="回复评价"
        open={isReplyModalVisible}
        onOk={async () => {
            try {
                const { content } = await formReply.validateFields();
                await replyToReview(currentReviewId, content);
                message.success('回复成功');
                setIsReplyModalVisible(false);
                const res = await getHotelReviews(hotelId!);
                setReviews(res.data);
            } catch { message.error('回复失败'); }
        }}
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