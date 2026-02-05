
---

# 🏨 易宿酒店平台 - 后端服务 (Yisu Hotel Platform Backend)

易宿酒店平台的后端 API 服务，基于 Node.js 和 Express 构建。本项目提供了一套完整的 RESTful API，涵盖用户认证、酒店管理、房型管理、订单处理、评价系统及收藏功能，并集成了 Redis 缓存、Winston 日志系统及 Swagger 自动化文档。

## 🛠️ 技术栈 (Tech Stack)

* **运行环境**: Node.js (v16+)
* **Web 框架**: Express.js
* **数据库**: MongoDB (Mongoose ODM)
* **缓存**: Redis
* **认证**: JWT (JSON Web Tokens)
* **测试框架**: Jest + Supertest
* **日志系统**: Winston + Morgan (支持每日滚动日志)
* **API 文档**: Swagger UI Express
* **代码质量**: SonarCloud / ESLint

## 📂 项目目录结构说明 (Project Structure)

```text
server
├── app.js                      # 🚀 应用入口文件：配置中间件、挂载路由、数据库连接、Swagger启动
├── README.md                   # 项目说明文档
├── package.json                # 项目依赖与脚本配置
├── package-lock.json           # 依赖版本锁定文件
├── eslint.config.js            # 代码风格检查配置
├── sonar-project.properties    # SonarCloud 代码质量检测配置
│
├── middleware/                 # 🛡️ 中间件层
│   ├── authMiddleware.js       # JWT 认证中间件：解析 Token，验证用户身份与权限
│   └── cache.js                # Redis 缓存中间件：拦截 GET 请求实现接口缓存（测试环境下跳过）
│
├── models/                     # 🗄️ 数据模型层 (Mongoose Schema)
│   ├── User.js                 # 用户模型
│   ├── Hotel.js                # 酒店模型 (含 LBS 地理位置索引)
│   ├── RoomType.js             # 房型与库存模型 (含价格日历)
│   ├── Order.js                # 订单模型
│   ├── Review.js               # 评价模型
│   ├── Favorite.js             # 收藏夹模型
│   └── Banner.js               # 首页轮播图模型
│
├── routes/                     # 🌐 路由层 (API Controllers)
│   ├── auth.js                 # 注册、登录
│   ├── users.js                # 用户信息管理
│   ├── hotels.js               # 酒店搜索、筛选、详情、商家管理
│   ├── rooms.js                # 房型增删改查、价格日历设置
│   ├── orders.js               # 下单、支付、取消、订单列表 (核心业务)
│   ├── reviews.js              # 发布评价、查看评价
│   ├── favorites.js            # 收藏/取消收藏
│   ├── banners.js              # 轮播图管理
│   └── upload.js               # 文件上传接口 (Multer)
│
├── utils/                      # 🔧 工具类
│   ├── logger.js               # Winston 日志封装：定义日志格式、文件存储策略
│   └── redis.js                # Redis 客户端单例封装：连接管理与错误处理
│
├── tests/                      # 🧪 测试文件目录 (Jest)
│   ├── app.test.js             # 根应用测试
│   ├── test_different_routes/  # 🧩 单元/集成测试：针对各个路由模块的功能测试
│   │   ├── auth.test.js
│   │   ├── hotels.test.js
│   │   └── ...
│   └── test_different_situations/ # 🎬 场景测试：复杂业务场景与压力测试
│       ├── concurrency.test.js    # 并发抢购测试
│       ├── full.test.js           # 全链路流程测试
│       ├── search.test.js         # 复杂搜索场景测试
│       └── security.test.js       # 安全性测试
│
├── logs/                       # 📝 运行时日志 (自动生成)
│   ├── application-*.log       # 业务逻辑与 HTTP 请求日志
│   └── error-*.log             # 错误堆栈日志
│
├── public/                     # 📦 静态资源目录
│   └── uploads/                # 用户上传的图片存储位置
│
└── swagger.* # 📖 API 文档配置

```

## 🚀 快速开始 (Getting Started)

### 1. 环境准备

确保本地已安装：

* [Node.js](https://nodejs.org/) (推荐 v16 或 v18 LTS)
* [MongoDB](https://www.mongodb.com/) (本地服务或 Atlas)
* [Redis](https://redis.io/) (本地服务或 Docker)

### 2. 安装依赖

```bash
cd server
npm install

```

### 3. 配置环境变量

在 `server` 根目录下创建 `.env` 文件，配置以下内容：

```ini
PORT=5000
MONGODB_URI=mongodb://localhost:27017/yisu-hotel-platform
# 测试环境数据库，跑测试时会自动切换
MONGODB_URI_TEST=mongodb://localhost:27017/yisu_test_db
JWT_SECRET=your_super_secret_key_change_this
REDIS_URL=redis://localhost:6379
NODE_ENV=development

```

### 4. 启动服务

**开发模式 (热更新):**
*(需先安装 nodemon: `npm install -g nodemon`)*

```bash
nodemon app.js

```

**生产模式:**

```bash
npm start

```

启动成功后：

* **API 服务**: `http://localhost:5000`
* **Swagger 文档**: `http://localhost:5000/api-docs`

## 🧪 测试 (Testing)

本项目拥有高覆盖率的测试套件（覆盖率 > 80%），涵盖了单元测试、集成测试及并发场景测试。

**运行所有测试:**

```bash
npm test

```

**运行特定测试:**

```bash
npm test tests/test_different_routes/hotels.test.js

```

**测试说明:**

* 测试运行时，`NODE_ENV` 会被设置为 `test`。
* **Redis 缓存中间件** 在测试环境下会自动失效（透传），以确保测试数据的实时性和准确性。
* 测试会自动连接独立的测试数据库，并在测试后清空数据。

## ✨ 核心特性实现

1. **高性能缓存**:
* 集成了 `Redis`，对高频读接口（如首页轮播图、酒店详情）进行缓存。
* 实现了自动过期策略与部分接口的主动缓存失效。


2. **安全性**:
* 使用 `Helmet` 设置安全 HTTP 头。
* 使用 `Express-Rate-Limit` 防止接口被恶意刷取。
* 完善的 JWT 鉴权与 RBAC（基于角色的权限控制）。


3. **可观测性**:
* 基于 `Winston` 实现结构化日志，按天滚动存储。
* 记录了详细的 HTTP 请求信息、错误堆栈及关键业务操作。


4. **健壮的业务逻辑**:
* **库存防超卖**: 订单系统经过并发测试验证。
* **LBS 搜索**: 支持基于地理位置（经纬度）的附近酒店搜索与排序。
* **价格日历**: 支持不同日期的特殊价格设置与合并逻辑。



## 👥 维护者

* Maintainer: cccccyccccc
* Email: blhxwiki@gmail.com

---
