const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
    // 自定义配置
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,      // 注入 process, __dirname, module 等全局变量
                ...globals.jest,      // 注入 describe, it, expect 等测试全局变量
            },
        },
        rules: {
            // 在这里覆盖或添加规则
            'no-unused-vars': 'warn', // 未使用的变量只报警告，不报错
            'no-console': 'off',      // 允许使用 console.log
        },
        ignores: ['node_modules/', 'dist/'], // 忽略的文件夹
    },
    // 关闭所有和 Prettier 冲突的格式化规则
    prettier,
];