/**
 * 测试数据填充脚本
 * 用于生成商户、酒店、房型、用户、订单、评价等测试数据
 * 
 * 运行方式: node scripts/seedTestData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Order = require('../models/Order');
const Review = require('../models/Review');

// ==================== 测试账户信息 ====================
const TEST_ACCOUNTS = {
  merchant: {
    username: 'test_merchant',
    password: '123456',
    role: 'merchant'
  },
  users: [
    { username: 'test_user1', password: '123456', role: 'user' },
    { username: 'test_user2', password: '123456', role: 'user' },
    { username: 'test_user3', password: '123456', role: 'user' },
    { username: 'test_user4', password: '123456', role: 'user' },
  ]
};

// ==================== 酒店数据 ====================
const HOTELS_DATA = [
  {
    name: '上海外滩豪华酒店',
    nameEn: 'Shanghai Bund Luxury Hotel',
    city: '上海',
    address: '上海市黄浦区中山东一路20号',
    location: { type: 'Point', coordinates: [121.490317, 31.240018] },
    starRating: 5,
    price: 1288,
    description: '位于外滩核心地段，尽享浦江两岸美景，顶级奢华体验',
    tags: ['外滩景观', '免费早餐', '健身房', 'SPA'],
    images: ['/uploads/hotels/bund1.jpg', '/uploads/hotels/bund2.jpg'],
    nearbyAttractions: ['外滩', '南京路步行街', '豫园'],
    nearbyTransport: ['地铁2号线南京东路站步行5分钟'],
    status: 1
  },
  {
    name: '北京长安精品酒店',
    nameEn: 'Beijing Chang\'an Boutique Hotel',
    city: '北京',
    address: '北京市东城区长安街88号',
    location: { type: 'Point', coordinates: [116.407394, 39.904211] },
    starRating: 4,
    price: 688,
    description: '地处核心商务区，交通便捷，服务周到',
    tags: ['商务出行', '会议室', '免费WiFi'],
    images: ['/uploads/hotels/beijing1.jpg'],
    nearbyAttractions: ['天安门广场', '故宫', '王府井'],
    nearbyTransport: ['地铁1号线天安门东站步行3分钟'],
    status: 1
  },
  {
    name: '杭州西湖花园酒店',
    nameEn: 'Hangzhou West Lake Garden Hotel',
    city: '杭州',
    address: '杭州市西湖区北山街78号',
    location: { type: 'Point', coordinates: [120.153575, 30.259244] },
    starRating: 5,
    price: 998,
    description: '西湖畔的诗意栖居，尽享湖光山色',
    tags: ['湖景房', '亲子', '免费停车', '下午茶'],
    images: ['/uploads/hotels/westlake1.jpg', '/uploads/hotels/westlake2.jpg'],
    nearbyAttractions: ['西湖', '灵隐寺', '雷峰塔'],
    nearbyTransport: ['公交游1路西湖站'],
    status: 1
  }
];

// ==================== 房型数据 ====================
const ROOM_TYPES_DATA = [
  { title: '豪华大床房', price: 1288, maxGuests: 2, bedInfo: '1张2米大床', size: '45㎡', stock: 10 },
  { title: '行政套房', price: 2588, maxGuests: 3, bedInfo: '1张2米大床+1张1.2米单人床', size: '80㎡', stock: 5 },
  { title: '标准双床房', price: 988, maxGuests: 2, bedInfo: '2张1.5米双人床', size: '38㎡', stock: 15 },
  { title: '家庭房', price: 1688, maxGuests: 4, bedInfo: '2张1.8米双人床', size: '60㎡', stock: 8 },
];

// ==================== 评价内容 ====================
const REVIEW_CONTENTS = [
  { rating: 5, content: '酒店位置绝佳，服务态度非常好，房间干净整洁，早餐丰富，下次还会再来！' },
  { rating: 5, content: '非常满意的一次入住体验，前台小姐姐很热情，还送了水果拼盘，五星好评！' },
  { rating: 4, content: '整体不错，房间设施齐全，就是隔音效果稍微差了点，其他都很好。' },
  { rating: 4, content: '交通方便，周边吃饭购物都很便利，性价比很高，推荐入住。' },
  { rating: 5, content: '带孩子来玩，酒店准备了儿童拖鞋和洗漱用品，很贴心！景色也很美。' },
  { rating: 3, content: '房间有点小，但是干净卫生，服务可以，价格合理。' },
];

async function seedData() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yisu');
    console.log('✅ 数据库连接成功');

    const hashedPassword = await bcrypt.hash('123456', 10);

    // 1. 创建商户账户
    console.log('\n📌 创建测试商户账户...');
    let merchant = await User.findOne({ username: TEST_ACCOUNTS.merchant.username });
    if (!merchant) {
      merchant = await User.create({
        username: TEST_ACCOUNTS.merchant.username,
        password: hashedPassword,
        role: TEST_ACCOUNTS.merchant.role
      });
      console.log(`   ✅ 商户创建成功: ${merchant.username}`);
    } else {
      console.log(`   ⚠️ 商户已存在: ${merchant.username}`);
    }

    // 2. 创建多个普通用户账户
    console.log('\n📌 创建测试用户账户...');
    const testUsers = [];
    for (const userData of TEST_ACCOUNTS.users) {
      let user = await User.findOne({ username: userData.username });
      if (!user) {
        user = await User.create({
          username: userData.username,
          password: hashedPassword,
          role: userData.role
        });
        console.log(`   ✅ 用户创建成功: ${user.username}`);
      } else {
        console.log(`   ⚠️ 用户已存在: ${user.username}`);
      }
      testUsers.push(user);
    }

    // 3. 创建酒店
    console.log('\n📌 创建测试酒店...');
    const createdHotels = [];
    for (const hotelData of HOTELS_DATA) {
      const existingHotel = await Hotel.findOne({
        name: hotelData.name,
        merchantId: merchant._id
      });

      if (!existingHotel) {
        const hotel = await Hotel.create({
          ...hotelData,
          merchantId: merchant._id
        });
        createdHotels.push(hotel);
        console.log(`   ✅ 创建酒店: ${hotel.name}`);
      } else {
        createdHotels.push(existingHotel);
        console.log(`   ⚠️ 酒店已存在: ${existingHotel.name}`);
      }
    }

    // 4. 创建房型
    console.log('\n📌 创建测试房型...');
    const createdRooms = [];
    for (const hotel of createdHotels) {
      for (let i = 0; i < 2; i++) {
        const roomData = ROOM_TYPES_DATA[i % ROOM_TYPES_DATA.length];
        const existingRoom = await RoomType.findOne({
          hotelId: hotel._id,
          title: roomData.title
        });

        if (!existingRoom) {
          const room = await RoomType.create({
            ...roomData,
            hotelId: hotel._id
          });
          createdRooms.push(room);
          console.log(`   ✅ 创建房型: ${hotel.name} - ${room.title}`);
        } else {
          createdRooms.push(existingRoom);
        }
      }
    }

    // 5. 创建订单 (使用不同用户)
    console.log('\n📌 创建测试订单...');
    const orderStatuses = ['pending', 'paid', 'completed', 'cancelled'];
    for (let i = 0; i < createdRooms.length; i++) {
      const room = createdRooms[i];
      const hotel = createdHotels.find(h => h._id.toString() === room.hotelId.toString());
      const user = testUsers[i % testUsers.length];

      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + Math.floor(Math.random() * 30));
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 3) + 1);

      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const quantity = Math.floor(Math.random() * 2) + 1;

      const order = await Order.create({
        userId: user._id,
        hotelId: hotel._id,
        roomTypeId: room._id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        quantity: quantity,
        totalPrice: room.price * nights * quantity,
        status: orderStatuses[i % orderStatuses.length]
      });
      console.log(`   ✅ 创建订单: ${hotel.name} - ${room.title} (${order.status}) - 用户:${user.username}`);
    }

    // 6. 创建评价 (每个用户对每个酒店只评价一次)
    console.log('\n📌 创建测试评价...');
    let reviewIndex = 0;
    for (const hotel of createdHotels) {
      // 随机选择几个用户来评价这个酒店
      const reviewerCount = Math.min(testUsers.length, Math.floor(Math.random() * 3) + 2);

      for (let j = 0; j < reviewerCount; j++) {
        const user = testUsers[j];
        const reviewData = REVIEW_CONTENTS[reviewIndex % REVIEW_CONTENTS.length];

        // 检查该用户是否已经评价过这个酒店
        const existingReview = await Review.findOne({
          userId: user._id,
          hotelId: hotel._id
        });

        if (!existingReview) {
          await Review.create({
            userId: user._id,
            hotelId: hotel._id,
            rating: reviewData.rating,
            content: reviewData.content
          });
          console.log(`   ✅ 创建评价: ${hotel.name} - ${reviewData.rating}星 - 用户:${user.username}`);
        } else {
          console.log(`   ⚠️ 评价已存在: ${hotel.name} - 用户:${user.username}`);
        }
        reviewIndex++;
      }

      // 更新酒店平均分
      const stats = await Review.aggregate([
        { $match: { hotelId: hotel._id } },
        { $group: { _id: '$hotelId', avgRating: { $avg: '$rating' } } }
      ]);
      if (stats.length > 0) {
        await Hotel.findByIdAndUpdate(hotel._id, {
          score: Math.round(stats[0].avgRating * 10) / 10
        });
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 测试数据填充完成！');
    console.log('='.repeat(50));
    console.log('\n📋 测试账户信息:');
    console.log(`   商户账号: ${TEST_ACCOUNTS.merchant.username}`);
    console.log(`   商户密码: ${TEST_ACCOUNTS.merchant.password}`);
    console.log('   ─────────────────────');
    for (const user of TEST_ACCOUNTS.users) {
      console.log(`   用户账号: ${user.username}  密码: ${user.password}`);
    }
    console.log('\n📊 数据统计:');
    console.log(`   酒店数量: ${createdHotels.length}`);
    console.log(`   房型数量: ${createdRooms.length}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已断开');
  }
}

seedData();
