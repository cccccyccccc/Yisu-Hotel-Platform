import { useEffect, useState, useRef } from 'react';
import {
  Form, Input, InputNumber, Button, Select, Upload,
  Space, Card, Row, Col, Cascader, DatePicker, Tooltip, App, Divider
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, EnvironmentOutlined, InfoCircleOutlined, 
  ShopOutlined, CarOutlined, RocketOutlined, TagsOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AMapLoader from '@amap/amap-jsapi-loader';
import dayjs from 'dayjs';
import { createHotel, updateHotel, getHotelDetail } from '@/api/hotels';
import { getHotelRoomTypes } from '@/api/rooms';
import { uploadImage } from '@/api/upload';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import { provinceCityData, findProvinceByCity } from '@/data/cities';
import styles from './HotelEdit.module.css';

const { TextArea } = Input;

// 配置高德安全密钥
if (typeof window !== 'undefined') {
  (window as any)._AMapSecurityConfig = {
    securityJsCode: '77c23574261c938c6d74008344c60ff1', 
  };
}

const HotelEditContent: React.FC = () => {
  const { message } = App.useApp(); 
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const amapObj = useRef<any>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const geocoder = useRef<any>(null);
  const geolocation = useRef<any>(null);

  const isEdit = !!id;

  useEffect(() => {
    AMapLoader.load({
      key: '14cf2ac7198b687730a69d24057f58de', 
      version: '2.0',
      plugins: ['AMap.Geocoder', 'AMap.PlaceSearch', 'AMap.Geolocation'],
    }).then((AMap) => {
      amapObj.current = AMap;
      initMap(AMap);
    }).catch(e => console.error("地图加载失败:", e));

    return () => mapInstance.current?.destroy();
  }, []);

  const initMap = (AMap: any) => {
    if (!mapRef.current) return;
    
    mapInstance.current = new AMap.Map(mapRef.current, { 
      zoom: 13, 
      center: [116.4074, 39.9042] 
    });
    
    geocoder.current = new AMap.Geocoder();
    geolocation.current = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      zoomToAccuracy: true,
    });

    markerInstance.current = new AMap.Marker({ 
      draggable: true, 
      cursor: 'move',
      position: [116.4074, 39.9042]
    });
    mapInstance.current.add(markerInstance.current);

    markerInstance.current.on('dragend', (e: any) => {
      const lnglat = [e.lnglat.lng, e.lnglat.lat] as [number, number];
      updateLocationInfo(lnglat);
    });

    mapInstance.current.on('click', (e: any) => {
      const lnglat = [e.lnglat.lng, e.lnglat.lat] as [number, number];
      markerInstance.current.setPosition(e.lnglat);
      updateLocationInfo(lnglat);
    });

    if (id) fetchHotelDetail();
  };

  const handleLocateCurrent = () => {
    if (!geolocation.current) return;
    message.loading({ content: '正在精确定位...', key: 'locate' });
    geolocation.current.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete') {
        const lnglat: [number, number] = [result.position.lng, result.position.lat];
        markerInstance.current.setPosition(lnglat);
        mapInstance.current.setCenter(lnglat);
        updateLocationInfo(lnglat);
        message.success({ content: '定位成功', key: 'locate' });
      } else {
        message.error({ content: '定位失败，请确保环境为 HTTPS 并授权', key: 'locate' });
      }
    });
  };

  const updateLocationInfo = (lnglat: [number, number]) => {
    form.setFieldValue('location', lnglat);
    
    geocoder.current?.getAddress(lnglat, (status: string, result: any) => {
      if (status === 'complete' && result.regeocode) {
        const { addressComponent, formattedAddress } = result.regeocode;
        form.setFieldValue('address', formattedAddress);
        const province = addressComponent.province;
        const city = (addressComponent.city && addressComponent.city.length > 0) 
                     ? addressComponent.city : addressComponent.district; 
        form.setFieldValue('city', [province, city]);
      }
    });

    const searchConfig = [
      { field: 'nearbyAttractions', type: '风景名胜' },
      { field: 'nearbyTransport', type: '地铁站|公交车站' },
      { field: 'nearbyMalls', type: '购物中心' }
    ];

    searchConfig.forEach(({ field, type }) => {
      const ps = new amapObj.current.PlaceSearch({ type, pageSize: 15 });
      ps.searchNearBy('', lnglat, 2000, (status: string, res: any) => {
        if (status === 'complete' && res.poiList) {
          const names = Array.from(new Set(res.poiList.pois.map((p: any) => p.name)));
          form.setFieldValue(field, names);
        }
      });
    });
  };

  const fetchHotelDetail = async () => {
    try {
      const res = await getHotelDetail(id!);
      const hotel = res.data;
      const cityPath = hotel.city ? findProvinceByCity(hotel.city) : null;

      form.setFieldsValue({
        ...hotel,
        city: cityPath || [hotel.city],
        openingTime: hotel.openingTime ? dayjs(hotel.openingTime, 'YYYY') : null,
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
      
      if (hotel.location?.coordinates && mapInstance.current) {
        const coords = hotel.location.coordinates as [number, number];
        mapInstance.current.setCenter(coords);
        markerInstance.current.setPosition(coords);
      }

      const { data: rooms } = await getHotelRoomTypes(id!);
      if (rooms?.length) {
        const minPrice = Math.min(...rooms.map((r: any) => r.price).filter((p: number) => p > 0));
        form.setFieldValue('price', minPrice);
      }
    } catch (e) { message.error('详情回显失败'); }
  };

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
    } catch (e) { message.error('图片上传失败'); }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const data = {
        ...values,
        city: Array.isArray(values.city) ? values.city[values.city.length - 1] : values.city,
        openingTime: values.openingTime?.format('YYYY'),
        location: { type: 'Point', coordinates: markerInstance.current.getPosition().toArray() },
        images: fileList.map(f => f.url),
      };
      isEdit ? await updateHotel(id!, data) : await createHotel(data);
      message.success('保存成功');
      navigate('/merchant/hotels');
    } catch (e) { message.error('提交失败'); } finally { setLoading(false); }
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

              {/* 新增：酒店标签一栏 */}
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    name="tags" 
                    label={<span><TagsOutlined /> 酒店标签 <Tooltip title="输入自定义标签后回车即可添加"><InfoCircleOutlined /></Tooltip></span>}
                  >
                    <Select 
                      mode="tags" 
                      style={{ width: '100%' }} 
                      placeholder="输入标签（如：免费停车、智能客控）并回车"
                      tokenSeparators={[',', ' ', '，']}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}><Form.Item name="city" label="所在城市" rules={[{ required: true }]}><Cascader options={provinceCityData} /></Form.Item></Col>
                <Col span={16}>
                  <Form.Item name="address" label="详细地址" rules={[{ required: true }]}>
                    <Input 
                      suffix={<EnvironmentOutlined onClick={handleLocateCurrent} style={{ color: '#4f8ef7', cursor: 'pointer' }} />} 
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="starRating" label="星级"><Select>{[1,2,3,4,5].map(s => <Select.Option key={s} value={s}>{'⭐'.repeat(s)}</Select.Option>)}</Select></Form.Item></Col>
                <Col span={8}>
                  <Form.Item name="price" label={<span>起始价格 <Tooltip title="基于房型最低价自动同步"><InfoCircleOutlined /></Tooltip></span>}>
                    <InputNumber prefix="¥" style={{ width: '100%' }} disabled placeholder="由房型同步" />
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
              <div ref={mapRef} className={styles.mapContainer} style={{ height: 350 }} />
              <Form.Item name="location" hidden><Input /></Form.Item>
            </Card>

            <Card title="周边信息" className={`${styles.formCard} ${styles.nearbySection}`}>
              <Form.Item name="nearbyAttractions" label={<span><RocketOutlined /> 附近景点</span>}>
                <Select mode="tags" placeholder="自动检索或手动输入" />
              </Form.Item>
              <Form.Item name="nearbyTransport" label={<span><CarOutlined /> 交通信息</span>}>
                <Select mode="tags" placeholder="自动检索或手动输入" />
              </Form.Item>
              <Form.Item name="nearbyMalls" label={<span><ShopOutlined /> 附近商场</span>}>
                <Select mode="tags" placeholder="自动检索或手动输入" />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <div className={styles.footerBar}>
          <Space>
            <Button size="large" onClick={() => navigate('/merchant/hotels')}>取消退出</Button>
            <Button type="primary" size="large" htmlType="submit" loading={loading} className={styles.submitBtn}>保存修改</Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

const HotelEdit = () => (
  <App><HotelEditContent /></App>
);

export default HotelEdit;