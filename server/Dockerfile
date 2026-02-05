# =====================================
# 阶段1: 构建依赖
# =====================================
ARG DOCKER_REGISTRY=docker.io
FROM ${DOCKER_REGISTRY}/node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖 (包括 devDependencies 用于构建)
RUN npm ci --only=production

# =====================================
# 阶段2: 生产镜像
# =====================================
ARG DOCKER_REGISTRY=docker.io
FROM ${DOCKER_REGISTRY}/node:18-alpine AS production

# 设置时区
ENV TZ=Asia/Shanghai

# 安装时区支持
RUN apk add --no-cache tzdata

WORKDIR /app

# 从构建阶段复制 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 创建上传目录
RUN mkdir -p public/uploads && \
  mkdir -p logs

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 -G nodejs && \
  chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# 启动命令
CMD ["node", "app.js"]
