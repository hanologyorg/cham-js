import { ref } from 'vue'

const message = ref('')

let timer: ReturnType<typeof setTimeout> | null = null

export function useAnnounce() {
  function announce(text: string) {
    if (import.meta.env.SSR) return
    message.value = ''
    requestAnimationFrame(() => { message.value = text })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { message.value = '' }, 5000)
  }

  return { message, announce }
}
