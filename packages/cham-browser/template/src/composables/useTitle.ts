import { useHead } from '@unhead/vue'

export function useTitle(title: string) {
  useHead({ title })
}
