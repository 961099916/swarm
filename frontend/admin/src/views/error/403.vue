<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/error/403.vue -->
<template>
  <div class="forbidden-wrapper">
    <div class="glow-orb"></div>
    <div class="content-box">
      <div class="icon-shield animate__animated animate__bounceIn">
        <el-icon :size="72" class="shield"><WarningFilled /></el-icon>
      </div>
      <h1 class="error-code">403</h1>
      <h2 class="error-title">安全限制 · 越权拒绝</h2>
      <p class="error-desc">
        抱歉，您的身份权限不足以访问此内网集群管理资源。<br/>
        系统已自动透传此 TraceID 并存入审计日志中。
      </p>
      <div class="trace-box" v-if="currentTraceId">
        <span class="trace-label">X-Trace-Id:</span>
        <span class="trace-value">{{ currentTraceId }}</span>
      </div>
      <div class="action-row">
        <el-button type="primary" class="back-btn" @click="handleRedirectLogin">
          重新校验身份
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { WarningFilled } from '@element-plus/icons-vue';

const router = useRouter();
const currentTraceId = ref('');

onMounted(() => {
  // 从 LocalStorage 或生成一个临时的 TraceID
  currentTraceId.value = localStorage.getItem('last_error_trace_id') || '403-BYPASS-BLOCK-BY-GATEWAY';
});

const handleRedirectLogin = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  router.push('/login');
};
</script>

<style scoped>
.forbidden-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #0b0c10;
  color: #ffffff;
  overflow: hidden;
  font-family: 'Outfit', 'Inter', sans-serif;
}

.glow-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(230, 57, 70, 0.15) 0%, rgba(230, 57, 70, 0) 70%);
  filter: blur(100px);
  pointer-events: none;
}

.content-box {
  position: relative;
  z-index: 10;
  text-align: center;
  max-width: 500px;
  padding: 48px;
  background: rgba(20, 20, 25, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}

.icon-shield {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 120px;
  background-color: rgba(230, 57, 70, 0.1);
  border-radius: 50%;
  margin-bottom: 24px;
  border: 1px solid rgba(230, 57, 70, 0.2);
}

.shield {
  color: #e63946;
}

.error-code {
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  margin: 0;
  letter-spacing: -2px;
  background: linear-gradient(135deg, #ff6b6b 0%, #e63946 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.error-title {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin: 12px 0 16px 0;
}

.error-desc {
  font-size: 14px;
  color: #8c9ba5;
  line-height: 1.6;
  margin: 0 0 28px 0;
}

.trace-box {
  display: inline-flex;
  gap: 8px;
  background-color: rgba(0, 0, 0, 0.4);
  padding: 8px 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  margin-bottom: 32px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.trace-label {
  color: #ff6b6b;
}

.trace-value {
  color: #a3b1cc;
}

.back-btn {
  height: 44px;
  padding: 0 32px;
  background: linear-gradient(90deg, #ff6b6b 0%, #e63946 100%);
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(230, 57, 70, 0.2);
  cursor: pointer;
  transition: all 0.25s ease;
}

.back-btn:hover {
  background: linear-gradient(90deg, #ff8585 0%, #ff4d5a 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(230, 57, 70, 0.3);
}
</style>
