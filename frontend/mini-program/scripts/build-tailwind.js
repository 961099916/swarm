/**
 * Tailwind CSS + weapp-tailwindcss 构建脚本（两阶段）
 * 阶段一：生成 Tailwind 原子 CSS
 * 阶段二：转译为小程序兼容格式
 */
'use strict';

const path = require('path');
const fs = require('fs');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const { weappTailwindcssPostcssPlugin } = require('weapp-tailwindcss/postcss');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.resolve(ROOT, 'src/tailwind.css');
const INTERIM = path.resolve(ROOT, 'src/tailwind-interim.css');
const OUTPUT = path.resolve(ROOT, 'static/styles/tailwind.wxss');

async function build() {
  const css = fs.readFileSync(ENTRY, 'utf8');

  // 阶段一：生成 Tailwind 原子 CSS
  const tailwindResult = await postcss([
    tailwindcss({
      config: path.resolve(ROOT, 'tailwind.config.js'),
    }),
    autoprefixer,
  ]).process(css, { from: ENTRY });

  fs.writeFileSync(INTERIM, tailwindResult.css);

  // 阶段二：转译为小程序兼容格式
  const finalResult = await postcss([
    weappTailwindcssPostcssPlugin,
  ]).process(tailwindResult.css, { from: INTERIM, to: OUTPUT });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, finalResult.css);

  // 清理临时文件
  fs.unlinkSync(INTERIM);

  console.log(`✓ Tailwind CSS 构建完成`);
  console.log(`  阶段一（生成）: ${tailwindResult.css.length} bytes`);
  console.log(`  阶段二（转译）: ${finalResult.css.length} bytes`);
  console.log(`  输出: ${OUTPUT}`);
}

build().catch(err => {
  console.error('✗ 构建失败:', err.message);
  process.exit(1);
});
