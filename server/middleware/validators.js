// 参数校验中间件
const { body, param, query, validationResult } = require('express-validator');

/**
 * 通用校验结果处理中间件
 * 放在具体校验规则之后使用
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      msg: errors.array()[0].msg, // 使用第一个错误信息作为主消息
      code: 'VALIDATION_ERROR',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// ==========================================
// 认证相关校验规则
// ==========================================
const authValidators = {
  register: [
    body('username')
      .trim()
      .notEmpty().withMessage('用户名不能为空')
      .isLength({ min: 2, max: 20 }).withMessage('用户名长度应为2-20个字符'),
    body('password')
      .notEmpty().withMessage('密码不能为空')
      .isLength({ min: 3, max: 50 }).withMessage('密码长度应为3-50个字符'),
    body('role')
      .optional()
      .isIn(['user', 'merchant', 'admin']).withMessage('角色值无效'),
    validate
  ],
  login: [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
    validate
  ]
};

// ==========================================
// 酒店相关校验规则
// ==========================================
const hotelValidators = {
  create: [
    body('name').trim().notEmpty().withMessage('酒店名称不能为空'),
    body('city').trim().notEmpty().withMessage('城市不能为空'),
    body('address').trim().notEmpty().withMessage('地址不能为空'),
    body('starRating')
      .notEmpty().withMessage('星级不能为空')
      .isInt({ min: 1, max: 5 }).withMessage('星级应为1-5之间的整数'),
    // 酒店起始价格可选（可由房型价格自动同步）
    body('price')
      .optional()
      .isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    body('location.coordinates')
      .optional()
      .isArray({ min: 2, max: 2 }).withMessage('坐标格式错误'),
    body('images').optional().isArray().withMessage('图片格式必须是数组'),
    body('tags').optional().isArray().withMessage('标签格式必须是数组'),
    validate
  ],
  update: [
    param('id').isMongoId().withMessage('无效的酒店ID'),
    body('name').optional().trim().notEmpty().withMessage('酒店名称不能为空'),
    body('city').optional().trim().notEmpty().withMessage('城市不能为空'),
    body('address').optional().trim().notEmpty().withMessage('地址不能为空'),
    body('starRating').optional().isInt({ min: 1, max: 5 }).withMessage('星级应为1-5之间的整数'),
    body('price').optional().isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    body('images').optional().isArray().withMessage('图片格式必须是数组'),
    body('location').optional(),
    body('tags').optional().isArray(),
    body('nearbyAttractions').optional().isArray(),
    body('nearbyTransport').optional().isArray(),
    body('nearbyMalls').optional().isArray(),
    body('openingTime').optional(),
    body('description').optional(),
    validate
  ],
  search: [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页条数应为1-100'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('最低价格必须大于等于0'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('最高价格必须大于等于0'),
    validate
  ],
  audit: [
    param('id').isMongoId().withMessage('无效的酒店ID'),
    body('status').isIn([1, 2]).withMessage('状态值无效'),
    validate
  ],
  status: [
    param('id').isMongoId().withMessage('无效的酒店ID'),
    body('status').isIn([1, 3]).withMessage('状态值无效'),
    validate
  ]
};

// ==========================================
// 订单相关校验规则
// ==========================================
const orderValidators = {
  create: [
    body('hotelId').isMongoId().withMessage('无效的酒店ID'),
    body('roomTypeId').isMongoId().withMessage('无效的房型ID'),
    body('checkInDate')
      .notEmpty().withMessage('入住日期不能为空')
      .isISO8601().withMessage('入住日期格式无效'),
    body('checkOutDate')
      .notEmpty().withMessage('离店日期不能为空')
      .isISO8601().withMessage('离店日期格式无效'),
    body('quantity')
      .optional()
      .isInt({ min: 1 }).withMessage('预订数量必须大于0'),
    validate
  ],
  cancel: [
    param('id').isMongoId().withMessage('无效的订单ID'),
    validate
  ]
};

// ==========================================
// 评价相关校验规则
// ==========================================
const reviewValidators = {
  create: [
    body('hotelId').isMongoId().withMessage('无效的酒店ID'),
    body('rating')
      .notEmpty().withMessage('评分不能为空')
      .isInt({ min: 1, max: 5 }).withMessage('评分应为1-5之间的整数'),
    body('content')
      .trim()
      .notEmpty().withMessage('评价内容不能为空')
      .isLength({ max: 500 }).withMessage('评价内容不能超过500字符'),
    validate
  ]
};

// ==========================================
// 房型相关校验规则
// ==========================================
const roomValidators = {
  create: [
    body('hotelId').isMongoId().withMessage('无效的酒店ID'),
    body('title').trim().notEmpty().withMessage('房型名称不能为空'),
    // 🟢 修改点：恢复为必填 notEmpty()
    body('price')
      .notEmpty().withMessage('价格不能为空')
      .isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    body('stock')
      .notEmpty().withMessage('库存不能为空')
      .isInt({ min: 0 }).withMessage('库存必须大于等于0'),
    validate
  ],
  update: [
    param('id').isMongoId().withMessage('无效的房型ID'),
    body('price').optional().isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    body('stock').optional().isInt({ min: 0 }).withMessage('库存必须大于等于0'),
    validate
  ],
  calendar: [
    param('id').isMongoId().withMessage('无效的房型ID'),
    body('calendarData').isArray().withMessage('日历数据必须是数组'),
    body('calendarData.*.date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('日期格式无效'),
    body('calendarData.*.price').isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    validate
  ]
};

// ==========================================
// 用户相关校验规则
// ==========================================
const userValidators = {
  updateProfile: [
    body('avatar').optional().isString().withMessage('头像地址必须是字符串'),
    body('gender').optional().isIn(['male', 'female', 'other', 'unknown']).withMessage('性别无效'), 
    body('bio').optional().isString().isLength({ max: 200 }).withMessage('简介不能超过200字'),
    validate
  ]
};

// ==========================================
// 轮播图相关校验规则
// ==========================================
const bannerValidators = {
  create: [
    body('imageUrl').notEmpty().withMessage('图片地址不能为空'),
    body('targetHotelId').isMongoId().withMessage('目标酒店ID无效'),
    body('priority').optional().isInt().withMessage('优先级必须是整数'),
    validate
  ]
};

// ==========================================
// 收藏相关校验规则
// ==========================================
const favoriteValidators = {
  hotelIdParam: [
    param('hotelId').isMongoId().withMessage('无效的酒店ID格式'),
    validate
  ]
};

module.exports = {
  validate,
  authValidators,
  hotelValidators,
  orderValidators,
  reviewValidators,
  roomValidators,
  userValidators,
  bannerValidators,
  favoriteValidators
};