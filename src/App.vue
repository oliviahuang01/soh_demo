<script setup>
import { ref } from 'vue'
import MetricHeader from './components/MetricHeader.vue'
import PopulationSohTab from './components/PopulationSohTab.vue'
import IndividualSohTab from './components/IndividualSohTab.vue'
import AlgorithmEvolutionTab from './components/AlgorithmEvolutionTab.vue'

const tabs = [
  { id: 'population', label: '群体 SOH 分析' },
  { id: 'individual', label: '单体 SOH 诊断' },
  { id: 'evolution', label: '算法演进与实测标定' },
]

const activeTab = ref('population')
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>SOH 算法平台展示</h1>
      <p>电池健康状态估计 · 群体分析 · 单体诊断 · 算法演进与实测标定</p>
    </header>

    <MetricHeader />

    <nav class="tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="tab-panel">
      <PopulationSohTab v-if="activeTab === 'population'" />
      <IndividualSohTab v-if="activeTab === 'individual'" />
      <AlgorithmEvolutionTab v-if="activeTab === 'evolution'" />
    </div>
  </div>
</template>
