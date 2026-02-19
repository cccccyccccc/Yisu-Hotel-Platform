import { useEffect, useState, useRef } from 'react';
import {
  Form, Input, InputNumber, Button, Select, Upload,
  Space, Card, Row, Col, Cascader, DatePicker, App, Modal
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AMapLoader from '@amap/amap-jsapi-loader';
import dayjs from 'dayjs';
import { createHotel, updateHotel, getHotelDetail } from '@/api/hotels';
import { getHotelRoomTypes } from '@/api/rooms';
import { uploadImage } from '@/api/upload';
import type { UploadFile, UploadProps, RcFile } from 'antd/es/upload';
import type { UploadFileStatus } from 'antd/es/upload/interface';
import { provinceCityData, findProvinceByCity } from '@/data/cities';
import styles from './HotelEdit.module.css';

const { TextArea } = Input;

// 🔴 调试核心：请确保此地址与后端服务地址完全一致
const API_BASE_URL = 'http://localhost:5000'; 

const getBase64 = (file: RcFile): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)._AMapSecurityConfig = {
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const geocoder = useRef<any>(null);
  const geolocation = useRef<any>(null);

  const isEdit = !!id;

  useEffect(() => {
    AMapLoader.load({
      key: '14cf2ac7198b687730a69d24057f58de',
      version: '2.0',
      plugins: ['AMap.Geocoder', 'AMap.Geolocation'],
    }).then((AMap) => {
      initMap(AMap);
    }).catch(e => console.error("地图加载失败:", e));
    return () => mapInstance.current?.destroy();
  }, []);

  useEffect(() => {
    if (id) fetchHotelDetail();
  }, [id]);

  const initMap = (AMap: any) => {
    if (!mapRef.current) return;
    mapInstance.current = new AMap.Map(mapRef.current, {
      zoom: 13,
      center: [116.4074, 39.9042],
    });
    geocoder.current = new AMap.Geocoder();
    geolocation.current = new AMap.Geolocation({ enableHighAccuracy: true });
    markerInstance.current = new AMap.Marker({ draggable: true, position: [116.4074, 39.9042] });
    mapInstance.current.add(markerInstance.current);
  };

  const updateLocationInfo = (lnglat: [number, number]) => {
    form.setFieldValue('location', lnglat);
    geocoder.current?.getAddress(lnglat, (status: string, result: any) => {
      if (status === 'complete' && result.regeocode) {
        const { addressComponent, formattedAddress } = result.regeocode;
        form.setFieldValue('address', formattedAddress);
        const city = addressComponent.city || addressComponent.district;
        form.setFieldValue('city', [addressComponent.province, city]);
      }
    });
  };

  const handleLocateCurrent = () => {
    if (!geolocation.current) return;
    geolocation.current.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete') {
        const lnglat: [number, number] = [result.position.lng, result.position.lat];
        markerInstance.current.setPosition(lnglat);
        mapInstance.current.setCenter(lnglat);
        updateLocationInfo(lnglat);
      }
    });
  };

  // --- 🛠 详情加载逻辑 (带日志) ---
  const fetchHotelDetail = async () => {
    try {
      console.log('--- [Debug] 开始获取酒店详情 ---');
      const res = await getHotelDetail(id!);
      const hotel = (res.data as any)?.data || res.data;
      console.log('1. 后端返回原始数据:', hotel);

      if (hotel) {
        form.setFieldsValue({
          ...hotel,
          city: hotel.city ? findProvinceByCity(hotel.city) || [hotel.city] : [],
          openingTime: hotel.openingTime ? dayjs(hotel.openingTime, 'YYYY') : null,
        });

        // 图片回显处理
        if (hotel.images && Array.isArray(hotel.images)) {
          console.log('2. 原始图片路径数组:', hotel.images);
          const formattedFiles: UploadFile[] = hotel.images.map((url: string, idx: number) => {
            const isAbsolute = url.startsWith('http');
            const finalUrl = isAbsolute ? url : `${API_BASE_URL}${url}`;
            console.log(`   图片[${idx}] 转换结果: ${finalUrl}`);
            
            return {
              uid: `-${idx}`,
              name: `image-${idx}`,
              status: 'done',
              url: finalUrl,
              thumbUrl: finalUrl, // 确保缩略图地址也正确
            };
          });
          console.log('3. 最终存入状态的 fileList:', formattedFiles);
          setFileList(formattedFiles);
        }
      }
    } catch (error) {
      console.error('[Debug] 加载详情失败:', error);
      message.error('加载失败');
    }
  };

  // --- 🛠 图片上传逻辑 (带日志) ---
  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      console.log('--- [Debug] 发起图片上传 ---');
      const res = await uploadImage(file as File);
      const relativeUrl = res.data.url; 
      console.log('1. 上传成功，后端返回相对路径:', relativeUrl);

      const absoluteUrl = `${API_BASE_URL}${relativeUrl}`;
      console.log('2. 拼接后的预览绝对地址:', absoluteUrl);

      const newFile: UploadFile = {
        uid: (file as RcFile).uid || Date.now().toString(),
        name: (file as RcFile).name,
        status: 'done',
        url: absoluteUrl,
        response: { url: relativeUrl } // 提交保存时用这个原始路径
      };
      
      setFileList(prev => {
        const next = [...prev, newFile];
        console.log('3. 当前 fileList 总状态:', next);
        return next;
      });
      onSuccess?.(res.data);
    } catch (err) {
      console.error('[Debug] 上传过程出错:', err);
      message.error('上传失败');
      onError?.(err as any);
    }
  };

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as RcFile);
    }
    setPreviewImage(file.url || (file.preview as string));
    setPreviewOpen(true);
    setPreviewTitle(file.name || '图片预览');
  };

  const handleRemove = (file: UploadFile) => {
    setFileList(prev => prev.filter(item => item.uid !== file.uid));
  };

  // --- 🛠 提交逻辑 (带日志) ---
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 🔴 路径剥离逻辑：只保存相对路径入库
      const processImages = fileList.map(f => {
        if (f.response?.url) return f.response.url; // 新上传
        if (f.url) return f.url.replace(API_BASE_URL, ''); // 已有图片剥离域名
        return null;
      }).filter(Boolean);
  
      // 🔴 安全获取坐标，防止 marker 未初始化崩溃
      const coordinates = markerInstance.current 
        ? markerInstance.current.getPosition().toArray() 
        : (values.location?.coordinates || [116.4074, 39.9042]);
  
      const data = {
        ...values,
        // 🔴 强制类型转换，防止后端 validator 400 报错
        starRating: Number(values.starRating), 
        price: values.price ? Number(values.price) : 0,
        city: Array.isArray(values.city) ? values.city[values.city.length - 1] : values.city,
        openingTime: (values.openingTime && typeof values.openingTime.format === 'function')
          ? values.openingTime.format('YYYY') : values.openingTime,
        location: { type: 'Point', coordinates: coordinates },
        images: processImages, 
      };
  
      console.log('--- [Debug] 最终提交数据 ---', data);
  
      if (isEdit) { 
        const res = await updateHotel(id!, data);
        console.log('--- [Debug] 修改成功返回:', res.data);
      } else { 
        await createHotel(data); 
      }
      
      message.success('保存成功');
      navigate('/merchant/hotels');
    } catch (error: any) { 
      console.error('[Debug] 提交异常:', error.response?.data || error);
      message.error(error.response?.data?.msg || '保存失败'); 
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
            <Card title="基础信息">
              <Row gutter={16}>
                <Col span={12}><Form.Item name="name" label="酒店名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="nameEn" label="英文名称"><Input /></Form.Item></Col>
              </Row>
              <Form.Item name="tags" label="标签"><Select mode="tags" /></Form.Item>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="city" label="城市" rules={[{ required: true }]}><Cascader options={provinceCityData} /></Form.Item></Col>
                <Col span={16}><Form.Item name="address" label="地址" rules={[{ required: true }]}><Input suffix={<EnvironmentOutlined onClick={handleLocateCurrent} />} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="starRating" label="星级"><Select>{[1,2,3,4,5].map(s=><Select.Option key={s} value={s}>{s}星</Select.Option>)}</Select></Form.Item></Col>
                <Col span={8}><Form.Item name="price" label="起始价格"><InputNumber prefix="¥" disabled style={{width:'100%'}} /></Form.Item></Col>
                <Col span={8}><Form.Item name="openingTime" label="开业年份"><DatePicker picker="year" style={{width:'100%'}}/></Form.Item></Col>
              </Row>
              <Form.Item name="description" label="简介"><TextArea rows={4} /></Form.Item>
            </Card>

            <Card title="酒店图片 (最多10张)" style={{ marginTop: 24 }}>
              <Upload
                listType="picture-card"
                fileList={fileList}
                customRequest={handleUpload}
                onPreview={handlePreview}
                onRemove={handleRemove}
              >
                {fileList.length < 10 && <div><PlusOutlined /><div style={{ marginTop: 8 }}>上传</div></div>}
              </Upload>
              <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={() => setPreviewOpen(false)}>
                <img alt="预览" style={{ width: '100%' }} src={previewImage} />
              </Modal>
            </Card>
          </Col>

          <Col span={9}>
            <Card title="地理位置">
              <div ref={mapRef} style={{ height: 350, background: '#f0f2f5' }} />
            </Card>
            <Card title="周边信息" style={{ marginTop: 24 }}>
              <Form.Item name="nearbyAttractions" label="附近景点"><Select mode="tags" /></Form.Item>
              <Form.Item name="nearbyTransport" label="交通信息"><Select mode="tags" /></Form.Item>
              <Form.Item name="nearbyMalls" label="附近商场"><Select mode="tags" /></Form.Item>
            </Card>
          </Col>
        </Row>

        <div className={styles.footerBar}>
          <Space>
            <Button onClick={() => navigate('/merchant/hotels')}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>提交保存</Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

const HotelEdit = () => (<App><HotelEditContent /></App>);
export default HotelEdit;