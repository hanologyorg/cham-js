import { ref, onMounted, onUnmounted } from 'vue'

export function useWindowSize() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

  onMounted(() => {
    function onResize() {
      width.value = window.innerWidth
      height.value = window.innerHeight
    }
    window.addEventListener('resize', onResize)
    onUnmounted(() => window.removeEventListener('resize', onResize))
  })

  return { width, height }
}
