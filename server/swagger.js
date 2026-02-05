const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json'); // 直接引入刚才创建的 JSON 文件

const setupSwagger = (app) => {
    // 访问 /api-docs 挂载文档
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    const port = process.env.PORT || 5000;
    console.log(`📄 Swagger 文档已就绪: http://localhost:${port}/api-docs`);
};

module.exports = setupSwagger;