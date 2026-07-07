<script setup>
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { loadFusionExampleData } from '../data/csvDataLoader.js'
import { getSohTier } from '../data/mockData.js'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const allSns = ref([])
const bySnMap = ref({})
const selectedSn = ref('')
const snInput = ref('')
const dropdownOpen = ref(false)
const result = ref(null)
const hasQueried = ref(false)

const filteredSns = computed(() => {
  const q = snInput.value.trim().toUpperCase()
  if (!q) return allSns.value
  return allSns.value.filter(sn => sn.toUpperCase().includes(q))
})

onMounted(() => {
  const { sns, bySnMap: map } = loadFusionExampleData()
  allSns.value = sns
  bySnMap.value = map
})

function openDropdown() { dropdownOpen.value = true }

function selectSn(sn) {
  selectedSn.value = sn
  snInput.value = sn
  dropdownOpen.value = false
}

function onSnInput() {
  dropdownOpen.value = true
  const exact = allSns.value.find(s => s.toUpperCase() === snInput.value.trim().toUpperCase())
  selectedSn.value = exact || ''
}

function onSnBlur() { setTimeout(() => { dropdownOpen.value = false }, 180) }

function onKeydown(e) {
  if (e.key === 'Enter' && selectedSn.value) handleQuery()
  if (e.key === 'Escape') dropdownOpen.value = false
}

function handleQuery() {
  hasQueried.value = true
  const rows = bySnMap.value[selectedSn.value]
  if (!rows || rows.length === 0) { result.value = null; return }

  const latestFusionRow = [...rows].reverse().find(r => r.sohFit != null) ?? null
  const latestFusion = latestFusionRow?.sohFit ?? null
  const abnormalRows = rows.filter(r => r.isAbnormal)
  const isAbnormal = abnormalRows.length > 0
  const avgVolDiff = abnormalRows.length
    ? abnormalRows.reduce((s, r) => s + (r.volDiff ?? 0), 0) / abnormalRows.length : null
  const avgSocDiff = abnormalRows.length
    ? abnormalRows.reduce((s, r) => s + (r.socDiff ?? 0), 0) / abnormalRows.length : null

  result.value = {
    sn: selectedSn.value,
    latestFusion,
    isAbnormal,
    avgVolDiff,
    avgSocDiff,
    healthLevel: latestFusionRow?.healthLevel ?? null,
    rankPercentile: latestFusionRow?.rankPercentile ?? null,
    groupSize: latestFusionRow?.groupSize ?? null,
    remainingKm: latestFusionRow?.remainingKm ?? null,
    rows,
  }
}

function healthLevelClass(level) {
  if (!level) return ''
  if (level.startsWith('A')) return 'tier-a'
  if (level.startsWith('B')) return 'tier-b'
  if (level.startsWith('C')) return 'tier-c'
  return 'tier-d'
}

const fusionTier = computed(() =>
  result.value?.latestFusion != null ? getSohTier(result.value.latestFusion) : null
)

const chartOption = computed(() => {
  if (!result.value?.rows?.length) return {}
  const rows = result.value.rows
  const xBms = rows.filter(r => r.sohBms != null).map(r => r.discharSum)
  const yBms = rows.filter(r => r.sohBms != null).map(r => r.sohBms)
  const fusionPoints = rows.map(r => r.sohFit != null ? [r.discharSum, r.sohFit] : null).filter(Boolean)
  const allX = [...xBms, ...fusionPoints.map(p => p[0])]
  const minX = Math.floor(Math.min(...allX) / 10000) * 10000
  const maxX = Math.ceil(Math.max(...allX) / 10000) * 10000
  const allY = [...yBms, ...fusionPoints.map(p => p[1])]
  const minY = Math.max(0, Math.floor(Math.min(...allY) - 5))
  const maxY = Math.min(100, Math.ceil(Math.max(...allY) + 2))
  return {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'cross' },
      formatter(params) {
        let html = `累计放电量: ${params[0]?.axisValue?.toLocaleString() ?? ''} kWh<br/>`
        params.forEach(p => {
          const val = Array.isArray(p.value) ? p.value[1] : p.value
          if (val != null) html += `${p.marker}${p.seriesName}: <b>${val}</b>%<br/>`
        })
        return html
      },
    },
    legend: { data: ['BMS 上报 SOH', 'Fusion SOH'], bottom: 0 },
    grid: { left: 56, right: 24, top: 36, bottom: 72 },
    dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'slider', xAxisIndex: 0, bottom: 32, height: 18 }],
    xAxis: {
      type: 'value', name: '累计放电量 (kWh)', nameLocation: 'middle', nameGap: 28,
      min: minX, max: maxX, axisLabel: { formatter: v => v.toLocaleString() },
    },
    yAxis: {
      name: 'SOH (%)', type: 'value', min: minY, max: maxY,
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    series: [
      { name: 'BMS 上报 SOH', type: 'line', smooth: false, symbol: 'none', lineStyle: { color: '#1677ff', width: 2 }, itemStyle: { color: '#1677ff' }, data: xBms.map((x, i) => [x, yBms[i]]), encode: { x: 0, y: 1 } },
      { name: 'Fusion SOH', type: 'scatter', symbolSize: 7, itemStyle: { color: '#13c2c2', opacity: 0.85 }, data: fusionPoints, encode: { x: 0, y: 1 } },
    ],
  }
})
</script>

<template>
  <div class="individual-tab">
    <div class="card">
      <div class="card-header"><span class="card-title">单体 SOH 查询</span></div>
      <div class="card-body">
        <div class="filter-bar">
          <span class="filter-label">电池 SN</span>
          <div class="sn-selector">
            <input
              v-model="snInput"
              class="sn-input"
              type="text"
              placeholder="输入或选择电池 SN…"
              autocomplete="off"
              @input="onSnInput"
              @focus="openDropdown"
              @blur="onSnBlur"
              @keydown="onKeydown"
            />
            <div v-if="dropdownOpen && filteredSns.length > 0" class="sn-dropdown">
              <div
                v-for="sn in filteredSns"
                :key="sn"
                class="sn-option"
                :class="{ selected: sn === selectedSn }"
                @mousedown.prevent="selectSn(sn)"
              >{{ sn }}</div>
            </div>
            <div v-if="dropdownOpen && snInput.trim() && filteredSns.length === 0" class="sn-dropdown">
              <div class="sn-option disabled">无匹配结果</div>
            </div>
          </div>
          <button class="btn-primary" :disabled="!selectedSn" @click="handleQuery">查询</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">查询结果</span></div>
      <div class="card-body">
        <div v-if="!hasQueried || !result" class="individual-empty">
          {{ hasQueried && !result ? '未找到该电池的有效数据' : '请输入或选择电池 SN 并点击查询' }}
        </div>
        <div v-else class="individual-result-row">
          <div class="individual-result-card">
            <div class="label">电池 SN</div>
            <div class="value value-sm">{{ result.sn }}</div>
          </div>
          <div class="individual-result-card">
            <div class="tier-bar" :class="fusionTier?.colorClass" />
            <div class="label">估计 SOH</div>
            <div class="value" :class="fusionTier?.colorClass">
              {{ result.latestFusion != null ? result.latestFusion : '—' }}<span style="font-size:16px">%</span>
            </div>
          </div>
          <div class="individual-result-card">
            <div class="label">算法判定</div>
            <div class="value">
              <span class="diagnosis-badge" :class="result.isAbnormal ? 'abnormal' : 'normal'">
                {{ result.isAbnormal ? 'SOH 异常' : 'SOH 正常' }}
              </span>
            </div>
          </div>
          <div class="individual-result-card">
            <div class="label">健康等级</div>
            <div class="value">
              <span v-if="result.healthLevel" class="health-badge" :class="healthLevelClass(result.healthLevel)">
                {{ result.healthLevel }}
              </span>
              <span v-else>—</span>
            </div>
          </div>
          <div class="individual-result-card">
            <div class="label">同型号排名</div>
            <div v-if="result.rankPercentile != null" class="value">
              前 {{ (100 - result.rankPercentile).toFixed(2) }}<span style="font-size:16px">%</span>
            </div>
            <div v-else class="value">—</div>
            <div v-if="result.groupSize != null" class="sub">优于 {{ result.rankPercentile }}% 同型号</div>
          </div>
          <div class="individual-result-card">
            <div class="label">预计剩余里程</div>
            <div v-if="result.remainingKm != null" class="value">
              <template v-if="result.remainingKm > 0">
                {{ result.remainingKm.toLocaleString() }}<span style="font-size:14px;font-weight:400;color:#8c8c8c"> km</span>
              </template>
              <span v-else style="font-size:16px;color:#ff4d4f">已达报废线</span>
            </div>
            <div v-else class="value">—</div>
            <div class="sub">报废线 SOH = 70%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="individual-layout">
      <div class="card">
        <div class="card-header"><span class="card-title">SOH 趋势（按累计放电量）</span></div>
        <div class="card-body">
          <div v-if="!result" class="individual-empty">暂无趋势数据</div>
          <template v-else>
            <div class="legend-inline" style="margin-bottom: 12px">
              <span class="legend-item"><span class="legend-line" style="background: #1677ff" /> BMS 上报 SOH（曲线）</span>
              <span class="legend-item"><span class="legend-dot" style="background: #13c2c2" /> 估计 SOH（散点）</span>
            </div>
            <VChart class="chart-container-sm" :option="chartOption" autoresize />
          </template>
        </div>
      </div>

      <div v-if="result" class="diagnosis-panel" :class="result.isAbnormal ? 'abnormal-bg' : 'normal-bg'">
        <h4>自动解读</h4>
        <div class="diagnosis-text"><strong>算法判定：</strong></div>
        <div class="diagnosis-text">当前 估计 SOH：{{ result.latestFusion != null ? result.latestFusion + '%' : '—' }}</div>
        <span class="diagnosis-badge" :class="result.isAbnormal ? 'abnormal' : 'normal'">
          {{ result.isAbnormal ? 'SOH 异常' : 'SOH 正常' }}
        </span>
        <div v-if="result.isAbnormal" class="diagnosis-causes">
          <h5>当前异常可能原因：</h5>
          <ul>
            <li v-if="result.avgVolDiff != null">低端静态压差：{{ result.avgVolDiff.toFixed(1) }} mV</li>
            <li v-if="result.avgSocDiff != null">低端 SOC 偏移：{{ result.avgSocDiff.toFixed(2) }} %</li>
          </ul>
        </div>
      </div>
      <div v-else class="diagnosis-panel">
        <h4>自动解读</h4>
        <div class="individual-empty" style="padding: 24px 0">查询后将展示算法判定结果</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">健康影响因素</span><span class="dev-badge">待开发</span></div>
      <div class="card-body placeholder-panel-compact">
        <h3 style="font-size:16px;margin-bottom:4px">功能规划中</h3>
        <p>健康影响因素分析模块开发中，后续将展示温度、充放电习惯、静态压差等对 SOH 衰减的影响权重与关联分析。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sn-selector {
  position: relative;
  min-width: 280px;
}

.sn-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  color: #262626;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.sn-input:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.sn-input::placeholder { color: #bfbfbf; }

.sn-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
}

.sn-option {
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  color: #262626;
  transition: background 0.15s;
}

.sn-option:hover { background: #f5f5f5; }
.sn-option.selected { background: #e6f4ff; color: #1677ff; font-weight: 500; }
.sn-option.disabled { color: #bfbfbf; cursor: default; }

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
</style>
