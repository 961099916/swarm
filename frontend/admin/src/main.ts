// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import router from './router';
import '@/router/guard';

// 引入全局 CSS 及 Element Plus 的暗色主题体系
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import './style.css';

const app = createApp(App);

// 注册所有 Element Plus 图标组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(ElementPlus);
app.use(router);

// Vue 全局运行时未捕获异常监听与友好提示容灾
app.config.errorHandler = (err: any, _instance, info) => {
  console.error('[Vue Global Error]', err, info);
  
  // 从 Error 信息中模糊提取 TraceID
  const errMsg = err instanceof Error ? err.message : String(err);
  const traceIdMatch = errMsg.match(/TraceID:\s*([a-f0-9-]+)/i);
  const traceId = traceIdMatch ? traceIdMatch[1] : 'N/A';

  ElMessageBox.alert(
    `系统遭遇未捕获的运行时崩溃异常，请联系技术管理员进行排查。\n\n异常明细: ${errMsg}\n\nTraceID: ${traceId}`,
    '系统崩溃诊断',
    {
      confirmButtonText: '复制诊断日志',
      cancelButtonText: '关闭',
      showCancelButton: true,
      type: 'error',
      callback: (action: any) => {
        if (action === 'confirm') {
          const detailLog = `Error: ${err instanceof Error ? err.stack : errMsg}\nContextInfo: ${info}\nTraceID: ${traceId}`;
          navigator.clipboard.writeText(detailLog)
            .then(() => {
              ElMessage.success('诊断日志已复制到剪切板，请提供给开发人员');
            })
            .catch(() => {
              ElMessage.error('浏览器复制失败，请手动截屏记录错误');
            });
        }
      }
    }
  );
};

app.mount('#app');


