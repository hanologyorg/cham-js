<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  vertical?: boolean
  scrollContainer?: HTMLElement | null
}>()

const visible = ref(false)
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    if (props.vertical && props.scrollContainer) {
      visible.value = props.scrollContainer.scrollLeft > 400
    } else {
      visible.value = window.scrollY > 400
    }
    ticking = false
  })
}

function scrollToTop() {
  if (props.vertical && props.scrollContainer) {
    props.scrollContainer.scrollTo({ left: props.scrollContainer.scrollWidth, behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function attach() {
  if (props.vertical && props.scrollContainer) {
    props.scrollContainer.addEventListener('scroll', onScroll, { passive: true })
  } else {
    window.addEventListener('scroll', onScroll, { passive: true })
  }
  onScroll()
}

function detach() {
  if (props.vertical && props.scrollContainer) {
    props.scrollContainer.removeEventListener('scroll', onScroll)
  } else {
    window.removeEventListener('scroll', onScroll)
  }
}

watch(() => props.scrollContainer, () => {
  detach()
  attach()
})

onMounted(attach)
onUnmounted(detach)
</script>

<template>
  <Transition name="btt">
    <button v-if="visible" class="btt" :class="{ 'btt-v': vertical }" @click="scrollToTop" aria-label="回到頂部">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.btt {
  position: fixed;
  bottom: 80px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-light);
  cursor: pointer;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.1);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.btt.btt-v {
  bottom: auto;
  top: 24px;
  right: auto;
  left: calc(var(--nav-width, 56px) + 12px);
}
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-light);
  cursor: pointer;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.1);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

@media (max-width: 768px) {
  .btt { bottom: 88px; right: 16px; width: 36px; height: 36px; }
}
.btt:hover {
  background: var(--vermillion);
  color: #fff;
  border-color: var(--vermillion);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(var(--shadow-rgb), 0.15);
}

.btt-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.btt-leave-active { transition: all 0.15s ease; }
.btt-enter-from { opacity: 0; transform: translateY(12px) scale(0.8); }
.btt-leave-to { opacity: 0; transform: translateY(8px) scale(0.9); }
</style>
