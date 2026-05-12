<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  vertical?: boolean
  scrollContainer?: HTMLElement | null
}>()

const progress = ref(0)
let raf = 0

function updateProgress() {
  if (props.vertical && props.scrollContainer) {
    const el = props.scrollContainer
    const max = el.scrollWidth - el.clientWidth
    progress.value = max > 0 ? Math.min((el.scrollLeft / max) * 100, 100) : 0
  } else if (!props.vertical) {
    const max = document.documentElement.scrollHeight - window.innerHeight
    progress.value = max > 0 ? Math.min((window.scrollY / max) * 100, 100) : 0
  }
}

function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(updateProgress)
}

function attach() {
  if (props.vertical && props.scrollContainer) {
    props.scrollContainer.addEventListener('scroll', onScroll, { passive: true })
  } else if (!props.vertical) {
    window.addEventListener('scroll', onScroll, { passive: true })
  }
  updateProgress()
}

function detach() {
  if (props.vertical && props.scrollContainer) {
    props.scrollContainer.removeEventListener('scroll', onScroll)
  } else {
    window.removeEventListener('scroll', onScroll)
  }
  cancelAnimationFrame(raf)
}

watch(() => props.scrollContainer, (el, old) => {
  detach()
  if (old) old.removeEventListener('scroll', onScroll)
  attach()
})

onMounted(attach)
onUnmounted(detach)
</script>

<template>
  <div
    class="rp"
    :class="{ 'rp-v': vertical }"
    :style="vertical
      ? { height: progress + '%' }
      : { width: progress + '%' }"
  />
</template>

<style scoped>
.rp {
  position: fixed;
  z-index: 1001;
  pointer-events: none;
  will-change: width, height;
  transition: width 0.1s ease, height 0.1s ease;
}
.rp:not(.rp-v) {
  top: 0; left: 0;
  height: 2px;
  background: var(--vermillion);
  box-shadow: 0 0 8px rgba(194, 58, 43, 0.3);
}
.rp-v {
  top: 0; left: 0;
  width: 2px;
  background: var(--vermillion);
  box-shadow: 0 0 8px rgba(194, 58, 43, 0.3);
}
</style>
