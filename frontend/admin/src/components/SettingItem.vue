<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/components/SettingItem.vue -->
<template>
  <el-form-item>
    <template #label>
      <div class="item-label-wrap">
        <span class="item-label-text">{{ label }}</span>
        <span v-if="isDirty" class="dirty-badge">未保存</span>
      </div>
    </template>
    
    <div v-if="description" class="item-description">
      {{ description }}
    </div>
    
    <!-- 数值型输入 -->
    <el-input-number
      v-if="type === 'number'"
      v-model="val"
      :min="min"
      :max="max"
      :step="step"
      :precision="precision"
      class="w-full"
    />
    <!-- 文本型输入 -->
    <el-input
      v-else
      v-model="val"
      :placeholder="placeholder"
      class="w-full"
    />
  </el-form-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    description?: string;
    type?: 'number' | 'text';
    modelValue: string | number;
    isDirty?: boolean;
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    placeholder?: string;
  }>(),
  {
    type: 'number',
    isDirty: false,
    min: 0,
    placeholder: ''
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: string | number): void;
}>();

const val = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
  }
});
</script>

<style scoped>
.item-label-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-label-text {
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
}

.dirty-badge {
  background: linear-gradient(90deg, #ff6b6b 0%, #ff8585 100%);
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  box-shadow: 0 0 10px rgba(255, 107, 107, 0.4);
  animation: breathe 2s infinite ease-in-out;
}

@keyframes breathe {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}

.item-description {
  font-size: 12px;
  color: #8c9ba5;
  margin-top: 2px;
  margin-bottom: 8px;
  line-height: 1.4;
}

.w-full {
  width: 100%;
}
</style>
