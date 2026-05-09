<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useReadingMode } from './composables/useReadingMode'
import ReadingToolbar from './components/ReadingToolbar.vue'
import { computed } from 'vue'

const router = useRouter()
const { toggleLayout, cycleTheme, layout } = useReadingMode()
const isVertical = computed(() => layout.value === 'vertical')

function onKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  if (event.key === 'Escape') router.push('/')
  if (event.key === 'v' || event.key === 'V') toggleLayout()
  if (event.key === 't' || event.key === 'T') cycleTheme()
}
</script>

<template>
  <div @keydown="onKey">
    <router-view v-slot="{ Component }">
      <Suspense>
        <component :is="Component" :key="$route.fullPath" />
      </Suspense>
    </router-view>
    <!-- 橫排模式才顯示浮動設定鈕 -->
    <ReadingToolbar v-if="!isVertical" />
  </div>
</template>
