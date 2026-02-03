module.exports = {
    env: {
        node: true,
        commonjs: true,
        es2021: true,
        jest: true, // 允许使用 jest 的全局变量
    },
    extends: ['eslint:recommended', 'prettier'], // 集成 prettier 防止冲突
    overrides: [],
    parserOptions: {
        ecmaVersion: 'latest',
    },
    rules: {
        'no-unused-vars': 'warn',
    },
};