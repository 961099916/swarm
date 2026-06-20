<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/quiz/index.vue -->
<template>
  <div class="quiz-container">
    <el-row :gutter="20">
      <!-- 左侧：用户评测进度治理 -->
      <el-col :span="8">
        <el-card class="glass-card full-height-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">用户评测进度治理</span>
            </div>
          </template>
          
          <div class="progress-manage-form">
            <p class="section-desc">
              物理重置指定用户的测评通关数据（清空各关卡进度记录与积分缓存），使该用户可以重新从第一关进行答题测试。
            </p>
            <el-form label-position="top">
              <el-form-item label="目标用户 ID" required>
                <el-input
                  v-model="targetUserId"
                  placeholder="请输入要重置进度的大端用户 ID"
                  clearable
                />
              </el-form-item>
              
              <div class="form-actions">
                <el-button
                  type="danger"
                  class="action-btn-danger"
                  :loading="resetLoading"
                  @click="handleResetProgress"
                >
                  物理重置评测进度
                </el-button>
              </div>
            </el-form>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：测评关卡配置热更新 -->
      <el-col :span="16">
        <el-card class="glass-card">
          <template #header>
            <div class="card-header header-actions">
              <span class="card-title">评测关卡题库与参数配置 (JSON)</span>
              <div class="header-buttons">
                <el-button size="small" @click="fetchConfigs" :loading="configLoading">
                  拉取最新
                </el-button>
                <el-button
                  size="small"
                  type="primary"
                  class="action-btn-primary"
                  @click="handleSaveConfigs"
                  :loading="saveLoading"
                >
                  保存并热更缓存
                </el-button>
              </div>
            </div>
          </template>

          <div class="config-editor-section">
            <p class="section-desc">
              系统当前所有关卡（NPC 题库、判断阈值、每关 EXP 收益）的全局配置。编辑后点击保存，系统将自动热更新 D1 配置数据库并强制驱逐 KV 缓存，立即对所有玩家生效。
            </p>
            <el-input
              v-model="configJsonText"
              type="textarea"
              :rows="20"
              placeholder="请输入关卡配置 JSON 数组"
              class="json-editor-textarea"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const targetUserId = ref('');
const resetLoading = ref(false);

const configJsonText = ref('[]');
const configLoading = ref(false);
const saveLoading = ref(false);

// ──────────────────────────────────────────────────
// 用户进度重置控制流
// ──────────────────────────────────────────────────
const handleResetProgress = () => {
  if (!targetUserId.value.trim()) {
    ElMessage.warning('请输入有效的目标用户 ID');
    return;
  }

  ElMessageBox.confirm(
    `确定要物理清空用户「${targetUserId.value}」的所有测评与答题进度记录吗？重置后该用户的 EXP 评级、段位与积分获取限制将恢复为初始状态。`,
    '重置测评进度确认',
    {
      confirmButtonText: '确定重置',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dark-message-box',
    }
  ).then(async () => {
    resetLoading.value = true;
    try {
      const res = await request.post(`/api/v1/admin/quiz/users/reset`, null, {
        params: {
          userId: targetUserId.value.trim(),
        },
      });
      if (res.data && res.data.success) {
        ElMessage.success('用户测评进度已物理重置成功，通关状态已初始化。');
        targetUserId.value = '';
      }
    } catch (err: any) {
      ElMessage.error(err.message || '重置进度请求失败');
    } finally {
      resetLoading.value = false;
    }
  }).catch(() => {});
};

// ──────────────────────────────────────────────────
// 关卡配置读取与热更新控制流
// ──────────────────────────────────────────────────
const fetchConfigs = async () => {
  configLoading.value = true;
  try {
    const res = await request.get(`/api/v1/admin/quiz/configs`);
    if (res.data && res.data.success) {
      const rawList = res.data.data || [];
      // 对返回的关卡 JSON 字符串进行反序列化，便于管理员直接进行结构化 JSON 编辑
      const parsedList = rawList.map((item: any) => {
        let parsedVal = item.value;
        try {
          if (typeof item.value === 'string') {
            parsedVal = JSON.parse(item.value);
          }
        } catch {
          // 若不是标准 JSON 字符串，则保持原样
        }
        return {
          key: item.key,
          value: parsedVal,
        };
      });
      configJsonText.value = JSON.stringify(parsedList, null, 2);
    }
  } catch (err: any) {
    ElMessage.error(err.message || '拉取关卡配置失败');
  } finally {
    configLoading.value = false;
  }
};

const handleSaveConfigs = async () => {
  saveLoading.value = true;
  try {
    // 客户端语法防御校验
    let rawList: any;
    try {
      rawList = JSON.parse(configJsonText.value);
    } catch (parseErr: any) {
      throw new Error(`JSON 语法解析失败: ${parseErr.message}`);
    }

    if (!Array.isArray(rawList)) {
      throw new Error('配置根节点必须是一个 JSON 数组形式');
    }

    // 逆转换：将 value 对象重新序列化为字符串传回后端
    const formattedConfigs = rawList.map((item: any) => {
      if (!item.key) {
        throw new Error("存在缺省 'key' 标识的配置项");
      }
      if (item.value === undefined) {
        throw new Error(`配置项 '${item.key}' 未指定 value 内容`);
      }
      
      const valStr = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      return {
        key: item.key,
        value: valStr,
      };
    });

    // 确认热更新高危动作
    await ElMessageBox.confirm(
      '确定要保存并热更新此测评关卡题库配置吗？保存后系统将自动清空所有关卡的二级缓存并即刻生效。',
      '更新系统配置确认',
      {
        confirmButtonText: '保存并生效',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'dark-message-box',
      }
    );

    const res = await request.put(`/api/v1/admin/quiz/configs`, {
      configs: formattedConfigs,
    });

    if (res.data && res.data.success) {
      ElMessage.success('系统关卡配置更新成功，缓存已强制同步驱逐。');
      fetchConfigs();
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '热更新关卡配置失败');
    }
  } finally {
    saveLoading.value = false;
  }
};

onMounted(() => {
  fetchConfigs();
});
</script>

<style scoped>
.quiz-container {
  padding: 0;
}

.glass-card {
  background: #0f111a !important;
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  border-radius: 16px !important;
  box-shadow: none !important;
}

.full-height-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  width: 100%;
}

.header-buttons {
  display: flex;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}

.section-desc {
  font-size: 13px;
  color: #a3b1cc;
  line-height: 1.6;
  margin-bottom: 20px;
}

.progress-manage-form {
  padding: 10px 0;
}

.form-actions {
  margin-top: 24px;
}

.action-btn-danger {
  width: 100%;
  height: 40px;
  font-weight: 600;
  border-radius: 8px;
}

.action-btn-primary {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%);
  border: none;
  font-weight: 600;
  border-radius: 8px;
}

.action-btn-primary:hover {
  background: linear-gradient(90deg, #ff8585 0%, #8522c7 100%);
}

.config-editor-section {
  padding: 10px 0;
}

.json-editor-textarea :deep(.el-textarea__inner) {
  background-color: #08090d !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #ffb86c !important; /* 橙黄代码高亮色调 */
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  line-height: 1.5;
  border-radius: 10px;
  padding: 16px;
}

.json-editor-textarea :deep(.el-textarea__inner:focus) {
  border-color: #ff6b6b !important;
  box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.2);
}
</style>
