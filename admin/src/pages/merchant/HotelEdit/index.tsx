import { useEffect, useState, useRef } from 'react';
import {
  Form, Input, InputNumber, Button, Select, Upload,
  message, Space, Card, Row, Col, Cascader, DatePicker, Tooltip
} from 'antd';
import {
  PlusOutlined, SaveOutlined, ArrowLeftOutlined, EnvironmentOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AMapLoader from '@amap/amap-jsapi-loader';
import dayjs from 'dayjs';
import { createHotel, updateHotel, getHotelDetail } from '@/api/hotels';
import { uploadImage } from '@/api/upload';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import { provinceCityData, findProvinceByCity } from '@/data/cities';
import styles from './HotelEdit.module.css';

const { TextArea } = Input;

// 高德地图全局实例引用
let AMap: any = null;
let mapInstance: any = null;
let markerInstance: any = null;
let geocoder: any = null;

const HotelEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const isEdit = !!id;

  // 1. 初始化高德地图
  useEffect(() => {
    AMapLoader.load({
      key: '14cf2ac7198b687730a69d24057f58de', // 需替换为实际Key
      version: '2.0',
      plugins: ['AMap.Geocoder', 'AMap.PlaceSearch'],
    }).then((AMapInstance) => {
      AMap = AMapInstance;
      initMap();
    }).catch(e => console.error("地图加载失败:", e));

    return () => mapInstance?.destroy();
  }, []);

  const initMap = () => {
    if (!mapRef.current) return;
    mapInstance = new AMap.Map(mapRef.current, { zoom: 13, center: [116.4074, 39.9042] });
    geocoder = new AMap.Geocoder();
    markerInstance = new AMap.Marker({ draggable: true, cursor: 'move' });
    mapInstance.add(markerInstance);

    // 拖动点位同步坐标和地址
    markerInstance.on('dragend', (e: any) => updateLocationInfo([e.lnglat.lng, e.lnglat.lat]));
    mapInstance.on('click', (e: any) => {
      markerInstance.setPosition(e.lnglat);
      updateLocationInfo([e.lnglat.lng, e.lnglat.lat]);
    });
  };

  // 2. 更新位置信息并自动检索周边 POI
  const updateLocationInfo = (lnglat: [number, number]) => {
    form.setFieldValue('location', lnglat);
    geocoder.getAddress(lnglat, (status: string, result: any) => {
      if (status === 'complete') form.setFieldValue('address', result.regeocode.formattedAddress);
    });

    const poiTypes = {
      nearbyAttractions: '050000', // 风景名胜
      nearbyTransport: '150000',    // 交通设施
      nearbyMalls: '060000',       // 购物服务
    };

    Object.entries(poiTypes).forEach(([field, code]) => {
      const ps = new AMap.PlaceSearch({ type: code, pageSize: 5 });
      ps.searchNearBy('', lnglat, 2000, (status: string, res: any) => {
        if (status === 'complete') {
          form.setFieldValue(field, res.poiList.pois.map((p: any) => p.name));
        }
      });
    });
  };

  // 3. 地址输入框失去焦点时同步地图
  const handleAddressBlur = (e: any) => {
    const address = e.target.value;
    if (!address || !geocoder) return;
    geocoder.getLocation(address, (status: string, result: any) => {
      if (status === 'complete' && result.geocodes.length) {
        const { location } = result.geocodes[0];
        const lnglat: [number, number] = [location.lng, location.lat];
        mapInstance.setCenter(lnglat);
        markerInstance.setPosition(lnglat);
        updateLocationInfo(lnglat);
      }
    });
  };

  // 4. 获取详情逻辑（处理图片预览和日期格式）
  const fetchHotelDetail = async () => {
    try {
      const res = await getHotelDetail(id!);
      const hotel = res.data;
      const cityPath = hotel.city ? findProvinceByCity(hotel.city) : null;

      form.setFieldsValue({
        ...hotel,
        city: cityPath || [hotel.city],
        openingTime: hotel.openingTime ? dayjs(hotel.openingTime, 'YYYY') : null,
        tags: hotel.tags || [],
        nearbyAttractions: hotel.nearbyAttractions || [],
        nearbyTransport: hotel.nearbyTransport || [],
        nearbyMalls: hotel.nearbyMalls || [],
      });

      if (hotel.images) {
        setFileList(hotel.images.map((url: string, idx: number) => ({
          uid: `${idx}`,
          name: `img-${idx}`,
          status: 'done',
          url,
          thumbUrl: url,
        })));
      }
      
      if (hotel.location?.coordinates) {
        const coords = hotel.location.coordinates;
        mapInstance?.setCenter(coords);
        markerInstance?.setPosition(coords);
      }
    } catch (error) { message.error('获取信息失败'); }
  };

  useEffect(() => { if (id && AMap) fetchHotelDetail(); }, [id, AMap]);

  // 5. 图片上传与删除
  const handleUpload: UploadProps['customRequest'] = async (options) => {
    try {
      const res = await uploadImage(options.file as File);
      setFileList(prev => [...prev, {
        uid: Date.now().toString(),
        name: (options.file as File).name,
        status: 'done',
        url: res.data.url,
        thumbUrl: res.data.url,
      }]);
      options.onSuccess?.(res.data);
    } catch (e) { message.error('上传失败'); }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const data = {
        ...values,
        city: values.city?.[1] || values.city?.[0],
        openingTime: values.openingTime?.format('YYYY'),
        location: { type: 'Point', coordinates: markerInstance.getPosition().toArray() },
        images: fileList.map(f => f.url),
      };
      isEdit ? await updateHotel(id!, data) : await createHotel(data);
      message.success('保存成功');
      navigate('/merchant/hotels');
    } catch (error: any) {
      message.error(error.response?.data?.msg || '操作失败');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/merchant/hotels')} />
        <h2 className={styles.title}>{isEdit ? '编辑酒店信息' : '添加新酒店'}</h2>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={24}>
          <Col span={15}>
            <Card title="基础信息" className={styles.formCard}>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="name" label="酒店名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="nameEn" label="英文名称"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="city" label="所在城市" rules={[{ required: true }]}><Cascader options={provinceCityData} /></Form.Item></Col>
                <Col span={16}>
                  <Form.Item name="address" label="详细地址" rules={[{ required: true }]}>
                    <Input placeholder="输入地址自动定位" onBlur={handleAddressBlur} suffix={<EnvironmentOutlined style={{ color: '#4f8ef7' }} />} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="starRating" label="星级" rules={[{ required: true }]}><Select>{[1,2,3,4,5].map(s => <Select.Option key={s} value={s}>{'⭐'.repeat(s)}</Select.Option>)}</Select></Form.Item></Col>
                <Col span={8}>
                  <Form.Item name="price" label={<span>起始价格 <Tooltip title="基于房型最低价自动同步"><InfoCircleOutlined /></Tooltip></span>}>
                    <InputNumber style={{ width: '100%' }} prefix="¥" placeholder="由系统计算" />
                  </Form.Item>
                </Col>
                <Col span={8}><Form.Item name="openingTime" label="开业年份"><DatePicker picker="year" style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Form.Item name="description" label="酒店简介"><TextArea rows={4} /></Form.Item>
            </Card>

            <Card title="酒店图片 (最多10张)" className={styles.formCard}>
              <Upload
                listType="picture-card"
                fileList={fileList}
                customRequest={handleUpload}
                onRemove={(file) => setFileList(prev => prev.filter(f => f.uid !== file.uid))}
              >
                {fileList.length < 10 && <div><PlusOutlined /><div style={{ marginTop: 8 }}>上传</div></div>}
              </Upload>
            </Card>
          </Col>

          <Col span={9}>
            <Card title="地理位置" className={styles.formCard}>
              <div ref={mapRef} className={styles.mapContainer} style={{ height: 350 }}>
                {!AMap && "地图加载中..."}
              </div>
              <p style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>可直接点击地图或拖动标记点微调位置</p>
              <Form.Item name="location" hidden><Input /></Form.Item>
            </Card>

            <Card title="周边信息" className={styles.formCard}>
              <Form.Item name="tags" label="特色标签"><Select mode="tags" placeholder="选择或手动输入" /></Form.Item>
              <Form.Item name="nearbyAttractions" label="附近景点"><Select mode="tags" /></Form.Item>
              <Form.Item name="nearbyTransport" label="交通信息"><Select mode="tags" /></Form.Item>
              <Form.Item name="nearbyMalls" label="附近商场"><Select mode="tags" /></Form.Item>
            </Card>
          </Col>
        </Row>

        <div className={styles.footerBar}>
          <Space>
            <Button size="large" onClick={() => navigate('/merchant/hotels')}>取消退出</Button>
            <Button type="primary" size="large" htmlType="submit" loading={loading} className={styles.submitBtn}>
              {isEdit ? '确认保存修改' : '提交酒店审核'}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default HotelEdit;