<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../composables/useI18n'
import SettingsPanel from './SettingsPanel.vue'

const { t } = useI18n()
const open = ref(false)

function toggle() { open.value = !open.value }
function close() { open.value = false }
</script>

<template>
  <div class="rt" :class="{ open }">
    <button class="rt-fab" @click="toggle" :aria-label="open ? t('settings.close') : t('settings.reading')">
      <span v-if="!open" class="rt-icon">{{ t('settings.shortTitle').charAt(0) }}</span>
      <span v-else class="rt-icon">✕</span>
    </button>
    <div v-if="open" class="rt-panel" @click.stop>
      <SettingsPanel :show-annotation-pane="true" />
    </div>
    <div v-if="open" class="rt-backdrop" @click="close" />
  </div>
</template>

<style scoped>
.rt {
  position: fixed;
  bottom: max(24px, calc(16px + env(safe-area-inset-bottom, 0px)));
  right: 24px;
  z-index: 500;
}

@media (max-width: 768px) {
  .rt { bottom: max(16px, calc(12px + env(safe-area-inset-bottom, 0px))); right: 16px; }
  .rt-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    left: 0;
    width: auto;
    border-radius: 16px 16px 0 0;
    max-height: 60vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
    animation: slideUpMobile 0.3s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }
  @keyframes slideUpMobile {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
}
.rt-fab {
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-mid);
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.12);
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; align-items: center; justify-content: center;
}
.rt-fab:hover {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
  transform: scale(1.05);
}
.rt-icon {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 15px;
}
.rt-panel {
  position: absolute;
  bottom: 56px;
  right: 0;
  width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.16);
  padding: 16px;
  animation: slideUp 0.25s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.rt-backdrop {
  position: fixed; inset: 0;
  z-index: -1;
}
</style>
