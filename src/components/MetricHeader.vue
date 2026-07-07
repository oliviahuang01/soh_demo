<script setup>
import { getOverviewMetrics } from '../data/mockData.js'

const OVERVIEW_METRICS = getOverviewMetrics()

const icons = {
  battery: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="18" height="12" rx="2"/><path d="M22 11v4M6 11v4M10 11v4M14 11v4"/></svg>`,
  types: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
  version: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  calibration: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
}
</script>

<template>
  <section class="metrics-row">
    <div
      v-for="item in OVERVIEW_METRICS"
      :key="item.key"
      class="metric-card"
      :class="{ highlight: item.highlight }"
    >
      <div class="metric-icon" v-html="icons[item.icon]" />
      <div class="metric-body">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value">
          {{ item.value.toLocaleString() }}<span class="unit">{{ item.unit }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
