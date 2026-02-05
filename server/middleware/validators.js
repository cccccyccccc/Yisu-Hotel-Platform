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
      msg: '参数校验失败',
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
    body('price')
      .notEmpty().withMessage('价格不能为空')
      .isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    body('location.coordinates')
      .optional()
      .isArray({ min: 2, max: 2 }).withMessage('坐标格式错误'),
    validate
  ],
  update: [
    param('id').isMongoId().withMessage('无效的酒店ID'),
    body('starRating').optional().isInt({ min: 1, max: 5 }).withMessage('星级应为1-5之间的整数'),
    body('price').optional().isFloat({ min: 0 }).withMessage('价格必须大于等于0'),
    validate
  ],
  search: [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页条数应为1-100'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('最低价格必须大于等于0'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('最高价格必须大于等于0'),
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
      .isInt({ min: 1 }).withMessage('房间数必须大于0'),
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
  ]
};

module.exports = {
  validate,
  authValidators,
  hotelValidators,
  orderValidators,
  reviewValidators,
  roomValidators
};
