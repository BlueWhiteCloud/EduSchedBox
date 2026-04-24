<template>
  <div id="app-container">
    <CustomTitleBar />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import CustomTitleBar from './components/CustomTitleBar.vue'
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  border: 2px solid var(--theme-color-light);
  border-top:none;
  border-radius: 8px;
  border-right: 3px solid var(--theme-color-light);
}

</style>
