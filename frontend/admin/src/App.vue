<template>
  <el-config-provider>
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
  document.documentElement.classList.add('dark');
});
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  background-color: #0b0c0f !important;
  color: #ffffff;
  height: 100%;
}
#app {
  height: 100%;
}
</style>
