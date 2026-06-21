const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // 使用绝对路径确保在 PostCSS CLI 中正确解析
    path.resolve(__dirname, 'pages/**/*.wxml'),
    path.resolve(__dirname, 'packageTask/**/*.wxml'),
    path.resolve(__dirname, 'packageKnowledge/**/*.wxml'),
    path.resolve(__dirname, 'packageQuiz/**/*.wxml'),
    path.resolve(__dirname, 'pages/chat/**/*.wxml'),
    path.resolve(__dirname, 'components/**/*.wxml'),
  ],
  // 小程序环境：不使用响应式断点（固定视口）
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false,
    container: false,
  },
};
