const path = require('path');
const { weappTailwindcssPostcssPlugin } = require('weapp-tailwindcss/postcss');
const tailwindcss = require('tailwindcss');

/**
 * weapp-tailwindcss PostCSS 配置
 * — tailwindcss：生成原子类（显式指定配置路径）
 * — autoprefixer：添加 CSS 前缀
 * — weappTailwindcssPostcssPlugin：转译为小程序兼容的 CSS
 */
module.exports = {
  plugins: [
    tailwindcss({
      config: path.resolve(__dirname, 'tailwind.config.js'),
    }),
    require('autoprefixer'),
    weappTailwindcssPostcssPlugin,
  ],
};
