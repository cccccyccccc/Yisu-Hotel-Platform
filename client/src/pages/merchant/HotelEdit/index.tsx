import { useEffect, useState } from 'react';
import {
  Form, Input, InputNumber, Button, Select, Upload,
  message, Space, Card, Row, Col
} from 'antd';
import {
  PlusOutlined, SaveOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { createHotel, updateHotel, getHotelDetail } from '@/api/hotels';
import { uploadImage } from '@/api/upload';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import styles from './HotelEdit.module.css';

const { TextArea } = Input;

// HotelCreateData 类型定义
interface HotelCreateData {
  name: string;
  nameEn?: string;
  city: string;
  address: string;
  starRating: number;
  price: number;
  openingTime?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  description?: string;
  tags?: string[];
  images?: string[];
  nearbyAttractions?: string[];
  nearbyTransport?: string[];
  nearbyMalls?: string[];
}

// 城市默认坐标映射 [经度, 纬度]
const cityCoordinates: Record<string, [number, number]> = {
  '北京': [116.4074, 39.9042],
  '上海': [121.4737, 31.2304],
  '广州': [113.2644, 23.1291],
  '深圳': [114.0579, 22.5431],
  '杭州': [120.1551, 30.2741],
  '成都': [104.0665, 30.5723],
  '西安': [108.9402, 34.3416],
  '重庆': [106.5516, 29.5630],
  '武汉': [114.3054, 30.5931],
  '南京': [118.7969, 32.0603],
};

const cities = Object.keys(cityCoordinates);

const HotelEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const isEdit = !!id;

  useEffect(() => {
    if (id) {
      fetchHotelDetail();
    }
  }, [id]);

  const fetchHotelDetail = async () => {
    try {
      const res = await getHotelDetail(id!);
      const hotel = res.data;
      form.setFieldsValue({
        ...hotel,
        tags: hotel.tags?.join(','),
        nearbyAttractions: hotel.nearbyAttractions?.join(','),
        nearbyTransport: hotel.nearbyTransport?.join(','),
        nearbyMalls: hotel.nearbyMalls?.join(','),
      });
      if (hotel.images) {
        setFileList(hotel.images.map((url, idx) => ({
          uid: `-${idx}`,
          name: `image-${idx}`,
          status: 'done' as const,
          url,
        })));
      }
    } catch (error) {
      message.error('获取酒店信息失败');
    }
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
      const res = await uploadImage(file as File);
      onSuccess?.(res.data);
      setFileList(prev => [...prev, {
        uid: Date.now().toString(),
        name: (file as File).name,
        status: 'done',
        url: res.data.url,
      }]);
    } catch (error) {
      onError?.(error as Error);
      message.error('图片上传失败');
    }
  };

  const handleRemove = (file: UploadFile) => {
    setFileList(prev => prev.filter(f => f.uid !== file.uid));
  };

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const city = values.city as string;
      const coordinates = cityCoordinates[city] || [116.4074, 39.9042]; // 默认北京坐标

      const data: HotelCreateData = {
        name: values.name as string,
        nameEn: values.nameEn as string,
        city: city,
        address: values.address as string,
        starRating: values.starRating as number,
        price: values.price as number,
        openingTime: values.openingTime as string,
        location: {
          type: 'Point',
          coordinates: coordinates,
        },
        description: values.description as string,
        tags: values.tags ? (values.tags as string).split(',').map(t => t.trim()).filter(Boolean) : [],
        images: fileList.map(f => f.url as string),
        nearbyAttractions: values.nearbyAttractions
          ? (values.nearbyAttractions as string).split(',').map(t => t.trim()).filter(Boolean)
          : [],
        nearbyTransport: values.nearbyTransport
          ? (values.nearbyTransport as string).split(',').map(t => t.trim()).filter(Boolean)
          : [],
        nearbyMalls: values.nearbyMalls
          ? (values.nearbyMalls as string).split(',').map(t => t.trim()).filter(Boolean)
          : [],
      };

      if (isEdit) {
        await updateHotel(id!, data);
        message.success('酒店信息更新成功');
      } else {
        await createHotel(data);
        message.success('酒店添加成功，等待审核');
      }
      navigate('/merchant/hotels');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      message.error(err.response?.data?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = () => {
    message.warning('请填写所有必填项');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/merchant/hotels')}
        >
          返回
        </Button>
        <h2 className={styles.title}>{isEdit ? '编辑酒店' : '添加酒店'}</h2>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        scrollToFirstError
        className={styles.form}
      >
        <Card title="基本信息" className={styles.card}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="酒店名称（中文）"
                rules={[{ required: true, message: '请输入酒店名称' }]}
              >
                <Input placeholder="请输入酒店名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nameEn" label="酒店名称（英文）">
                <Input placeholder="请输入英文名称（可选）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="city"
                label="所在城市"
                rules={[{ required: true, message: '请选择城市' }]}
              >
                <Select placeholder="请选择城市">
                  {cities.map(city => (
                    <Select.Option key={city} value={city}>{city}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="address"
                label="详细地址"
                rules={[{ required: true, message: '请输入详细地址' }]}
              >
                <Input placeholder="请输入详细地址" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="starRating"
                label="酒店星级"
                rules={[{ required: true, message: '请选择星级' }]}
              >
                <Select placeholder="请选择星级">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Select.Option key={star} value={star}>
                      {'⭐'.repeat(star)} {star}星级
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="price"
                label="起始价格"
                rules={[{ required: true, message: '请输入价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  prefix="¥"
                  placeholder="请输入起始价格"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="openingTime" label="开业时间">
                <Input placeholder="如：2021年" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="酒店简介">
            <TextArea rows={3} placeholder="请输入酒店简介" />
          </Form.Item>
        </Card>

        <Card title="酒店图片" className={styles.card}>
          <Upload
            listType="picture-card"
            fileList={fileList}
            customRequest={handleUpload}
            onRemove={handleRemove}
            accept="image/*"
          >
            {fileList.length < 10 && (
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传图片</div>
              </div>
            )}
          </Upload>
          <p className={styles.uploadTip}>最多上传10张图片，支持jpg、png格式</p>
        </Card>

        <Card title="标签与附近信息" className={styles.card}>
          <Form.Item name="tags" label="酒店标签">
            <Input placeholder="请输入标签，用逗号分隔，如：豪华,亲子,免费停车" />
          </Form.Item>
          <Form.Item name="nearbyAttractions" label="附近景点">
            <Input placeholder="请输入附近景点，用逗号分隔" />
          </Form.Item>
          <Form.Item name="nearbyTransport" label="交通信息">
            <Input placeholder="请输入交通信息，用逗号分隔" />
          </Form.Item>
          <Form.Item name="nearbyMalls" label="附近商场">
            <Input placeholder="请输入附近商场，用逗号分隔" />
          </Form.Item>
        </Card>

        <div className={styles.footer}>
          <Space size="large">
            <Button onClick={() => navigate('/merchant/hotels')}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
              className={styles.submitBtn}
            >
              {isEdit ? '保存修改' : '提交审核'}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default HotelEdit;
