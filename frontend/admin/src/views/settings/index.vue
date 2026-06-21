<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/settings/index.vue -->
<template>
  <div class="settings-container">
    <!-- 顶部标题与流光面板 -->
    <div class="header-banner glass-card">
      <div class="banner-content">
        <h2 class="title-text">
          <el-icon class="title-icon"><Setting /></el-icon>
          系统内核参数热更新
        </h2>
        <p class="subtitle-text">
          管理并动态调整集群微服务内核配置。所有修改将自动同步至 SQLite system_configs 表，并在 10 秒内热更新至所有 Worker 节点的本地 Isolate 级内存缓存。
        </p>
      </div>
    </div>

    <!-- 大厂规范：脏检查未保存批量修改预警通栏 -->
    <div v-if="dirtyKeys.length > 0" class="dirty-alert-banner fade-in">
      <div class="alert-left">
        <el-icon class="alert-icon"><Warning /></el-icon>
        <span class="alert-text">您修改了 <strong>{{ dirtyKeys.length }}</strong> 项系统配置尚未保存，这可能会导致各节点配置不一致。</span>
      </div>
      <div class="alert-actions">
        <el-button size="small" class="discard-btn" @click="discardChanges">放弃修改</el-button>
        <el-button size="small" type="primary" class="save-all-btn" :loading="saving" @click="saveAllDirty">保存全部</el-button>
      </div>
    </div>

    <!-- 主体多标签配置表单 -->
    <el-tabs v-model="activeTab" class="dark-tabs" v-loading="loading">
      <!-- 📌 Tab 1: 算力积分域 -->
      <el-tab-pane label="算力积分域 (Credits)" name="credits">
        <el-card class="glass-card form-card">
          <template #header>
            <div class="card-header-wrap">
              <span class="card-header-title">
                <el-icon><Money /></el-icon>算力账本与激励奖励系数
              </span>
              <el-button 
                type="primary" 
                class="save-btn" 
                :disabled="!hasGroupDirty('credits')" 
                :loading="saving" 
                @click="saveGroup('credits')"
              >
                保存本组配置
              </el-button>
            </div>
          </template>

          <el-form :model="formData" label-position="top" class="dark-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="初始注册赠送算力 (credits.initial_credits)"
                  description="新用户首次授权登录时赠送的系统初始积分额度。"
                  v-model="formData['credits.initial_credits']"
                  :is-dirty="isKeyDirty('credits.initial_credits')"
                  :step="5"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="邀请注册奖励额度 (credits.invite_reward)"
                  description="每次成功邀请并绑定新用户时给发起者的积分奖励。"
                  v-model="formData['credits.invite_reward']"
                  :is-dirty="isKeyDirty('credits.invite_reward')"
                  :step="5"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="广告观看奖励额度 (credits.ad_reward)"
                  description="前端用户完整观看激励视频广告后发放的算力积分值。"
                  v-model="formData['credits.ad_reward']"
                  :is-dirty="isKeyDirty('credits.ad_reward')"
                  :step="5"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="启动任务扣减算力 (credits.task_cost)"
                  description="多智能体引擎启动单次协同编排任务所消耗的基础算力。"
                  v-model="formData['credits.task_cost']"
                  :is-dirty="isKeyDirty('credits.task_cost')"
                  :min="1"
                  :step="1"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="默认单页加载条数 (credits.default_page_limit)"
                  description="算力日志与交易流水单页默认渲染的最大条数。"
                  v-model="formData['credits.default_page_limit']"
                  :is-dirty="isKeyDirty('credits.default_page_limit')"
                  :min="5"
                  :max="100"
                  :step="5"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="单日获取积分上限 (credits.credits_limit)"
                  description="单个用户单日通过完成任务/看广告等手段能累计充值的上限。"
                  v-model="formData['credits.credits_limit']"
                  :is-dirty="isKeyDirty('credits.credits_limit')"
                  :min="10"
                  :step="10"
                />
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 📌 Tab 2: 知识库与 RAG 域 -->
      <el-tab-pane label="知识库与 RAG 域 (RAG)" name="rag">
        <el-card class="glass-card form-card">
          <template #header>
            <div class="card-header-wrap">
              <span class="card-header-title">
                <el-icon><Notebook /></el-icon>向量索引与分块召回参数
              </span>
              <el-button 
                type="primary" 
                class="save-btn" 
                :disabled="!hasGroupDirty('rag')" 
                :loading="saving" 
                @click="saveGroup('rag')"
              >
                保存 RAG 配置
              </el-button>
            </div>
          </template>

          <el-form :model="formData" label-position="top" class="dark-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="默认文本切片大小 (knowledge.default_chunk_size)"
                  description="对文档提取纯文本后，进行物理切块（Chunk）的字符单元长度。"
                  v-model="formData['knowledge.default_chunk_size']"
                  :is-dirty="isKeyDirty('knowledge.default_chunk_size')"
                  :min="100"
                  :max="5000"
                  :step="100"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="默认切片重叠度 (knowledge.default_chunk_overlap)"
                  description="相邻文本块之间的重叠字符数，用于保持语义的上下文连贯。"
                  v-model="formData['knowledge.default_chunk_overlap']"
                  :is-dirty="isKeyDirty('knowledge.default_chunk_overlap')"
                  :min="0"
                  :max="1000"
                  :step="20"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="文档召回片段数 Top-K (knowledge.default_top_k)"
                  description="向量余弦相似度检索时，召回并填入 Prompt 提示词的最大相关片段数。"
                  v-model="formData['knowledge.default_top_k']"
                  :is-dirty="isKeyDirty('knowledge.default_top_k')"
                  :min="1"
                  :max="20"
                  :step="1"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="检索最小相关度分数 (knowledge.default_min_score)"
                  description="只有余弦相似度分数大于等于该值的文本切片才会被注入到 RAG 上下文中。"
                  v-model="formData['knowledge.default_min_score']"
                  :is-dirty="isKeyDirty('knowledge.default_min_score')"
                  :min="0.0"
                  :max="1.0"
                  :step="0.05"
                  :precision="2"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="最大总上下文长度 (knowledge.max_context_length)"
                  description="限制最终组合完成的 RAG 系统提示词与参考上下文的总字符长度。"
                  v-model="formData['knowledge.max_context_length']"
                  :is-dirty="isKeyDirty('knowledge.max_context_length')"
                  :min="500"
                  :max="16000"
                  :step="500"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="支持上传的最大文件字节 (knowledge.max_file_size)"
                  description="用户上传文档解析的最大容量限制。默认 10MB (10485760 字节)。"
                  v-model="formData['knowledge.max_file_size']"
                  :is-dirty="isKeyDirty('knowledge.max_file_size')"
                  :min="1024"
                  :step="1048576"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="最大并行生成向量数 (knowledge.max_concurrent_embeddings)"
                  description="单个文档切片时允许并发请求嵌入接口（Embedding）的并发阈值。"
                  v-model="formData['knowledge.max_concurrent_embeddings']"
                  :is-dirty="isKeyDirty('knowledge.max_concurrent_embeddings')"
                  :min="1"
                  :max="50"
                  :step="1"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="默认嵌入向量物理模型 (knowledge.default_embed_model)"
                  description="后端模型路由引用的 CF Workers AI 向量模型 Key。"
                  type="text"
                  v-model="formData['knowledge.default_embed_model']"
                  :is-dirty="isKeyDirty('knowledge.default_embed_model')"
                />
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 📌 Tab 3: 工作流与 AI 默认模型配置 -->
      <el-tab-pane label="工作流与 AI 模型 (Workflow)" name="workflow">
        <el-card class="glass-card form-card">
          <template #header>
            <div class="card-header-wrap">
              <span class="card-header-title">
                <el-icon><Cpu /></el-icon>多智能体协同引擎与默认大模型
              </span>
              <el-button 
                type="primary" 
                class="save-btn" 
                :disabled="!hasGroupDirty('workflow')" 
                :loading="saving" 
                @click="saveGroup('workflow')"
              >
                保存工作流配置
              </el-button>
            </div>
          </template>

          <el-form :model="formData" label-position="top" class="dark-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="单次任务最大协同循环轮数 (workflow.default_max_loops)"
                  description="防止智能体陷入无限死循环（Infinite Loops）的强制中断判定安全熔断轮数。"
                  v-model="formData['workflow.default_max_loops']"
                  :is-dirty="isKeyDirty('workflow.default_max_loops')"
                  :min="1"
                  :max="30"
                  :step="1"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="系统默认大语言模型内核 (workflow.default_model)"
                  description="当未特别指定模型路由时，协同引擎默认使用的 LLM Key。"
                  type="text"
                  v-model="formData['workflow.default_model']"
                  :is-dirty="isKeyDirty('workflow.default_model')"
                />
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 📌 Tab 4: 评测与经验配置 -->
      <el-tab-pane label="评测与关卡经验 (Quiz)" name="quiz">
        <el-card class="glass-card form-card">
          <template #header>
            <div class="card-header-wrap">
              <span class="card-header-title">
                <el-icon><Checked /></el-icon>关卡晋升升级经验与测验通过率
              </span>
              <el-button 
                type="primary" 
                class="save-btn" 
                :disabled="!hasGroupDirty('quiz')" 
                :loading="saving" 
                @click="saveGroup('quiz')"
              >
                保存评测配置
              </el-button>
            </div>
          </template>

          <el-form :model="formData" label-position="top" class="dark-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="关卡升级经验基底 (quiz.exp_per_level)"
                  description="游戏化测评关卡中，玩家每升一级所需的基本 EXP 经验公式基数。"
                  v-model="formData['quiz.exp_per_level']"
                  :is-dirty="isKeyDirty('quiz.exp_per_level')"
                  :min="50"
                  :step="50"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="测验考核通过率阈值 (quiz.quiz_pass_threshold)"
                  description="答对题目占比。如 0.6 表示至少正确解答 60% 才能算合格通过。"
                  v-model="formData['quiz.quiz_pass_threshold']"
                  :is-dirty="isKeyDirty('quiz.quiz_pass_threshold')"
                  :min="0.1"
                  :max="1.0"
                  :step="0.05"
                  :precision="2"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="通过关卡额外发放经验 (quiz.exp_stage_pass)"
                  description="玩家一次性成功答题通过新关卡时，获取的 EXP 经验值奖励。"
                  v-model="formData['quiz.exp_stage_pass']"
                  :is-dirty="isKeyDirty('quiz.exp_stage_pass')"
                  :min="0"
                  :step="5"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="测评全部完成一次性奖励 (quiz.exp_quiz_complete)"
                  description="完整打通整套评测试卷后，向用户灌注的丰厚大礼包经验值。"
                  v-model="formData['quiz.exp_quiz_complete']"
                  :is-dirty="isKeyDirty('quiz.exp_quiz_complete')"
                  :min="0"
                  :step="5"
                />
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <setting-item
                  label="计分测验保底发放经验 (quiz.exp_quiz_calculate)"
                  description="参与测验并提交计算分数的行为所获得的保底阳光普照奖经验。"
                  v-model="formData['quiz.exp_quiz_calculate']"
                  :is-dirty="isKeyDirty('quiz.exp_quiz_calculate')"
                  :min="0"
                  :step="1"
                />
              </el-col>
              <el-col :span="12">
                <setting-item
                  label="评测历史留存最大条数 (quiz.test_history_max_limit)"
                  description="为了防止 SQLite 膨胀，对用户测验历史答题明细进行滚动清理的最大记录条数限制。"
                  v-model="formData['quiz.test_history_max_limit']"
                  :is-dirty="isKeyDirty('quiz.test_history_max_limit')"
                  :min="10"
                  :step="10"
                />
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Setting, Money, Notebook, Cpu, Checked, Warning } from '@element-plus/icons-vue';
import request from '@/utils/request';
import SettingItem from '@/components/SettingItem.vue';

const activeTab = ref('credits');
const loading = ref(false);
const saving = ref(false);

// 配置对应限界上下文的分组列表
const configGroups: Record<string, string[]> = {
  credits: [
    'credits.initial_credits',
    'credits.invite_reward',
    'credits.ad_reward',
    'credits.task_cost',
    'credits.default_page_limit',
    'credits.credits_limit'
  ],
  rag: [
    'knowledge.default_chunk_size',
    'knowledge.default_chunk_overlap',
    'knowledge.default_top_k',
    'knowledge.default_min_score',
    'knowledge.max_context_length',
    'knowledge.max_file_size',
    'knowledge.max_concurrent_embeddings',
    'knowledge.default_embed_model'
  ],
  workflow: [
    'workflow.default_max_loops',
    'workflow.default_model'
  ],
  quiz: [
    'quiz.exp_per_level',
    'quiz.quiz_pass_threshold',
    'quiz.exp_stage_pass',
    'quiz.exp_quiz_complete',
    'quiz.exp_quiz_calculate',
    'quiz.test_history_max_limit'
  ]
};

// 反应式表单数据与原始备份快照
const formData = reactive<Record<string, any>>({
  'credits.initial_credits': 50,
  'credits.invite_reward': 50,
  'credits.ad_reward': 20,
  'credits.task_cost': 5,
  'credits.default_page_limit': 20,
  'credits.credits_limit': 50,

  'knowledge.default_chunk_size': 500,
  'knowledge.default_chunk_overlap': 100,
  'knowledge.default_top_k': 5,
  'knowledge.default_min_score': 0.4,
  'knowledge.max_context_length': 3000,
  'knowledge.max_file_size': 10485760,
  'knowledge.max_concurrent_embeddings': 10,
  'knowledge.default_embed_model': '@cf/baai/bge-small-en-v1.5',

  'workflow.default_max_loops': 5,
  'workflow.default_model': '@cf/meta/llama-3.1-8b-instruct-fp8',

  'quiz.exp_per_level': 100,
  'quiz.quiz_pass_threshold': 0.6,
  'quiz.exp_stage_pass': 20,
  'quiz.exp_quiz_complete': 10,
  'quiz.exp_quiz_calculate': 5,
  'quiz.test_history_max_limit': 200
});

const originalData = reactive<Record<string, any>>({});

// 脏键列表监测计算属性
const dirtyKeys = computed(() => {
  return Object.keys(formData).filter((key) => formData[key] !== originalData[key]);
});

// 单个 key 的脏状态判定
const isKeyDirty = (key: string) => {
  return formData[key] !== originalData[key];
};

// 判定某个配置分组内是否有被更改的项
const hasGroupDirty = (groupName: string) => {
  const keys = configGroups[groupName];
  if (!keys) return false;
  return keys.some((key) => isKeyDirty(key));
};

// 从服务端拉取最新系统动态参数配置
const fetchConfigs = async () => {
  loading.value = true;
  try {
    const res = await request.get('/api/v1/admin/configs');
    if (res.data.success) {
      const data = res.data.data;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach((key) => {
          if (key in formData) {
            formData[key] = data[key];
            originalData[key] = data[key];
          }
        });
      }
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取系统动态配置失败');
  } finally {
    loading.value = false;
  }
};

// 一键保存所有脏配置键（利用批量更新接口）
const saveAllDirty = async () => {
  if (dirtyKeys.value.length === 0) return;
  saving.value = true;
  try {
    const configs = dirtyKeys.value.map((key) => ({
      key,
      value: typeof formData[key] === 'number' ? formData[key] : String(formData[key])
    }));

    await request.put('/api/v1/admin/configs', { configs });
    ElMessage.success(`成功批量保存并发布了 ${configs.length} 项配置参数！`);
    await fetchConfigs();
  } catch (err: any) {
    ElMessage.error(err.message || '批量保存失败');
  } finally {
    saving.value = false;
  }
};

// 放弃更改，回退到备份值
const discardChanges = () => {
  Object.keys(originalData).forEach((key) => {
    formData[key] = originalData[key];
  });
  ElMessage.info('已撤销全部修改项，配置已复位');
};

// 保存指定 Tab 限界上下文内的局部配置
const saveGroup = async (groupName: string) => {
  const keysToSave = configGroups[groupName].filter((key) => isKeyDirty(key));
  if (keysToSave.length === 0) return;

  saving.value = true;
  try {
    const configs = keysToSave.map((key) => ({
      key,
      value: typeof formData[key] === 'number' ? formData[key] : String(formData[key])
    }));

    await request.put('/api/v1/admin/configs', { configs });
    ElMessage.success(`[${groupName.toUpperCase()}] 分组内 ${configs.length} 项参数已更新并同步发布！`);
    await fetchConfigs();
  } catch (err: any) {
    ElMessage.error(err.message || '保存分组配置失败');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchConfigs();
});
</script>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 顶部流光 banner */
.header-banner {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.05) 0%, rgba(114, 9, 183, 0.05) 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  border-radius: 16px !important;
  padding: 24px !important;
}

.banner-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-text {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  color: #ff6b6b;
}

.subtitle-text {
  font-size: 13px;
  color: #8c9ba5;
  line-height: 1.6;
  margin: 0;
}

/* 脏检查未保存提示通栏 */
.dirty-alert-banner {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.15) 0%, rgba(114, 9, 183, 0.15) 100%);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 12px;
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.15);
}

.alert-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-icon {
  color: #ff6b6b;
  font-size: 18px;
}

.alert-text {
  font-size: 13px;
  color: #e2e8f0;
}

.alert-text strong {
  color: #ff6b6b;
  font-size: 15px;
}

.alert-actions {
  display: flex;
  gap: 10px;
}

.discard-btn {
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #a0aec0 !important;
  transition: all 0.2s;
}

.discard-btn:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  color: #ffffff !important;
}

.save-all-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%) !important;
  border: none !important;
  color: #ffffff !important;
  font-weight: 600;
  transition: transform 0.2s;
}

.save-all-btn:hover {
  transform: translateY(-1px);
}

/* 标签样式与卡片 */
.glass-card {
  background: #0f111a !important;
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  border-radius: 16px !important;
  box-shadow: none !important;
}

.form-card {
  padding: 8px 16px;
  margin-top: 12px;
}

.card-header-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}

.save-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%);
  border: none;
  font-weight: 600;
  border-radius: 8px;
  padding: 10px 20px;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.save-btn:hover:not(.is-disabled) {
  background: linear-gradient(90deg, #ff8585 0%, #8522c7 100%);
  transform: translateY(-1px);
}

.save-btn:active:not(.is-disabled) {
  transform: translateY(1px);
}

.save-btn.is-disabled {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.03) !important;
  color: rgba(255, 255, 255, 0.2) !important;
}

/* Element Form 覆写样式，保证契合暗黑风格 */
:deep(.el-input-number .el-input__inner) {
  text-align: left;
  font-family: 'Outfit', 'Inter', monospace;
  font-weight: 600;
}

:deep(.el-input__wrapper),
:deep(.el-select .el-input__wrapper),
:deep(.el-textarea__inner) {
  background-color: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  box-shadow: none !important;
  border-radius: 8px !important;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-textarea__inner:focus) {
  border-color: rgba(255, 107, 107, 0.5) !important;
}

:deep(.el-input__inner),
:deep(.el-textarea__inner) {
  color: #e2e8f0 !important;
}

@keyframes slideDown {
  from { transform: translateY(-15px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-15px); opacity: 0; }
}
</style>
