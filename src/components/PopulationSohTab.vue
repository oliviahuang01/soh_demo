<script setup>
import { ref, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart, BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import { loadPopulationData } from '../data/csvDataLoader.js'
import { getTheoreticalLines } from '../data/mockData.js'

use([CanvasRenderer, ScatterChart, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const TYPE_LABELS = {
  lhp284: 'LHP-284',
  cvp400: 'CVP-400',
  bc3:    'BC-3',
  all:    '全部型号',
}

const allData = loadPopulationData()

const typeOptions = computed(() => {
  const types = [...new Set(allData.map(d => d.type))].sort()
  return [{ id: 'all', label: '全部型号' }, ...types.map(t => ({ id: t, label: TYPE_LABELS[t] || t }))]
})

const selectedType = ref('all')

const filteredData = computed(() =>
  selectedType.value === 'all' ? allData : allData.filter(d => d.type === selectedType.value)
)

const summary = computed(() => {
  const data = filteredData.value
  if (!data.length) return { total: 0, avgSoh: '—', decayRate: '—', abnormalRatio: '—' }
  const total = data.length
  const avgSoh = (data.reduce((s, d) => s + d.soh, 0) / total).toFixed(1)
  const abnormal = data.filter(d => d.isAbnormal).length
  const abnormalRatio = ((abnormal / total) * 100).toFixed(1)

  // 衰减速率：用线性回归 soh ~ discharSum
  const n = data.length
  const sumX = data.reduce((s, d) => s + d.discharSum, 0)
  const sumY = data.reduce((s, d) => s + d.soh, 0)
  const sumXY = data.reduce((s, d) => s + d.discharSum * d.soh, 0)
  const sumX2 = data.reduce((s, d) => s + d.discharSum * d.discharSum, 0)
  const denom = n * sumX2 - sumX * sumX
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  // slope 单位是 %/kWh，转成 %/万kWh
  const decayRate = Math.abs(slope * 10000).toFixed(3)

  return { total, avgSoh, decayRate, abnormalRatio }
})

const sohDistribution = computed(() => {
  const data = filteredData.value
  const ranges = [
    { min: 95, max: 101, label: '95-100%' },
    { min: 90, max: 95,  label: '90-95%' },
    { min: 85, max: 90,  label: '85-90%' },
    { min: 80, max: 85,  label: '80-85%' },
    { min: 75, max: 80,  label: '75-80%' },
    { min: 70, max: 75,  label: '70-75%' },
    { min: 0,  max: 70,  label: '<70%' },
  ]
  return ranges.map(range => {
    const count = data.filter(d => d.soh >= range.min && d.soh < range.max).length
    const percentage = data.length ? +((count / data.length) * 100).toFixed(1) : 0
    return { ...range, count, percentage }
  })
})

const distributionOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params) => {
      const d = params[0]
      const dist = sohDistribution.value[d.dataIndex]
      return `${d.name}<br/>数量: ${d.value} 套 (${dist.percentage}%)`
    },
  },
  grid: { left: 60, right: 30, top: 30, bottom: 50 },
  xAxis: {
    type: 'category',
    data: sohDistribution.value.map(d => d.label),
    axisLabel: { fontSize: 11 },
  },
  yAxis: { name: '电池数量', type: 'value' },
  series: [{
    type: 'bar',
    data: sohDistribution.value.map(d => d.count),
    itemStyle: {
      color: (params) => ['#52c41a','#73d13d','#95de64','#ffc53d','#ff7a45','#ff4d4f','#a8071a'][params.dataIndex],
    },
    label: { show: true, position: 'top', formatter: '{c}', fontSize: 11 },
  }],
}))

const abnormalBatteries = computed(() =>
  filteredData.value
    .filter(d => d.isAbnormal)
    .map(d => ({
      sn: d.sn,
      type: TYPE_LABELS[d.type] || d.type,
      soh: d.soh,
      discharSum: d.discharSum,
      status: d.soh < 75 ? '严重异常' : '轻度异常',
    }))
    .sort((a, b) => a.soh - b.soh)
    .slice(0, 10)
)

const chartOption = computed(() => {
  const data = filteredData.value
  const normal   = data.filter(d => !d.isAbnormal)
  const abnormal = data.filter(d => d.isAbnormal)
  const allX = data.map(d => d.discharSum)
  const maxX = allX.length ? Math.ceil(Math.max(...allX) / 100000) * 100000 : 600000
  const typeIdMap = { lhp284: 'LFP-280', cvp400: 'LFP-314', bc3: 'NCM-280', all: 'all' }
  const theoryLines = getTheoreticalLines(typeIdMap[selectedType.value] ?? 'all')

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const d = params.data
        return [
          `<b>${d.sn}</b>`,
          `型号: ${TYPE_LABELS[d.type] || d.type}`,
          `估计 SOH: ${d.soh}%`,
          `累计放电量: ${(d.discharSum / 10000).toFixed(1)} 万kWh`,
          d.isAbnormal ? '<span style="color:#ff4d4f">⚠ 异常识别</span>' : '',
        ].filter(Boolean).join('<br/>')
      },
    },
    legend: { data: ['估计 SOH', '异常电池', ...theoryLines.map(t => t.name)], bottom: 0, type: 'scroll' },
    grid: { left: 60, right: 30, top: 30, bottom: 80 },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, bottom: 36, height: 18 },
    ],
    xAxis: {
      name: '累计放电量 (万kWh)',
      nameLocation: 'middle',
      nameGap: 30,
      type: 'value',
      min: 0,
      max: maxX,
      axisLabel: { formatter: v => (v / 10000).toFixed(0) },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    yAxis: {
      name: 'SOH (%)',
      type: 'value',
      min: 60,
      max: 105,
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    series: [
      {
        name: '估计 SOH',
        type: 'scatter',
        symbolSize: 6,
        itemStyle: { color: 'rgba(22, 119, 255, 0.5)' },
        data: normal.map(d => ({ value: [d.discharSum, d.soh], ...d })),
        large: true,
        largeThreshold: 300,
      },
      {
        name: '异常电池',
        type: 'scatter',
        symbol: 'pin',
        symbolSize: 14,
        itemStyle: { color: '#ff4d4f' },
        data: abnormal.map(d => ({ value: [d.discharSum, d.soh], ...d })),
        z: 10,
      },
      ...theoryLines.map(t => ({
        name: t.name,
        type: 'line',
        smooth: false,
        showSymbol: false,
        lineStyle: { color: t.color, width: 2, type: t.lineType },
        data: t.data.map(([mwh, soh]) => [mwh * 1000, soh]),
        z: 5,
      })),
    ],
  }
})
</script>

<template>
  <div class="population-layout">
    <div class="card">
      <div class="card-header">
        <span class="card-title">群体 SOH 散点分布</span>
        <div class="filter-bar">
          <span class="filter-label">电池型号</span>
          <select v-model="selectedType" class="select-input">
            <option v-for="t in typeOptions" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div class="legend-inline" style="margin-bottom: 12px">
          <span class="legend-item">
            <span class="legend-dot" style="background: rgba(22,119,255,0.6)" />
            估计 SOH
          </span>
          <span class="legend-item">
            <span class="legend-dot" style="background: #ff4d4f" />
            SOH 异常电池
          </span>
        </div>
        <VChart class="chart-container" :option="chartOption" autoresize />
      </div>
    </div>

    <aside class="summary-cards">
      <div class="summary-card">
        <div class="label">总电池数</div>
        <div class="value">{{ summary.total.toLocaleString() }}<span style="font-size:16px;font-weight:400;color:#8c8c8c"> 套</span></div>
        <div class="sub">当前筛选范围内有效样本</div>
      </div>
      <div class="summary-card">
        <div class="label">当前平均 SOH</div>
        <div class="value success">{{ summary.avgSoh }}<span style="font-size:16px">%</span></div>
        <div class="sub">群体健康状态均值</div>
      </div>
      <div class="summary-card">
        <div class="label">衰减速率</div>
        <div class="value">{{ summary.decayRate }}<span style="font-size:14px;font-weight:400;color:#8c8c8c"> % / 万kWh</span></div>
        <div class="sub">基于估计 SOH 线性回归</div>
      </div>
      <div class="summary-card">
        <div class="label">异常电池占比</div>
        <div class="value danger">{{ summary.abnormalRatio }}<span style="font-size:16px">%</span></div>
        <div class="sub">算法识别异常样本比例</div>
      </div>
    </aside>
  </div>

  <div class="card" style="margin-top: 24px">
    <div class="card-header">
      <span class="card-title">SOH 分布区间</span>
      <span style="font-size: 12px; color: #8c8c8c">当前筛选电池型号：{{ TYPE_LABELS[selectedType] || selectedType }}</span>
    </div>
    <div class="card-body">
      <VChart class="chart-container-sm" :option="distributionOption" autoresize />
    </div>
  </div>

  <div class="card" style="margin-top: 24px">
    <div class="card-header">
      <span class="card-title">异常预警电池列表</span>
      <span style="font-size: 12px; color: #8c8c8c">Top 10 · 按 SOH 升序排列</span>
    </div>
    <div class="card-body">
      <div v-if="!abnormalBatteries.length" style="text-align:center;padding:32px;color:#8c8c8c;font-size:14px">
        当前筛选范围内无异常电池
      </div>
      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>电池 SN</th>
              <th>电池类型</th>
              <th>当前 SOH</th>
              <th>累计放电量</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(battery, index) in abnormalBatteries" :key="battery.sn">
              <td>{{ index + 1 }}</td>
              <td><code>{{ battery.sn }}</code></td>
              <td>{{ battery.type }}</td>
              <td>
                <span class="soh-value" :class="battery.soh < 75 ? 'critical' : 'warning'">
                  {{ battery.soh }}%
                </span>
              </td>
              <td>{{ (battery.discharSum / 10000).toFixed(1) }} 万kWh</td>
              <td>
                <span class="status-badge" :class="battery.status === '严重异常' ? 'critical' : 'warning'">
                  {{ battery.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.data-table thead { background: #fafafa; }
.data-table th { padding: 12px 16px; text-align: left; font-weight: 600; color: #262626; border-bottom: 2px solid #f0f0f0; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
.data-table tbody tr:hover { background: #fafafa; }
.data-table code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-family: 'Consolas', monospace; }
.soh-value { font-weight: 600; }
.soh-value.critical { color: #cf1322; }
.soh-value.warning { color: #d46b08; }
.status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.status-badge.critical { background: #fff1f0; color: #cf1322; border: 1px solid #ffccc7; }
.status-badge.warning { background: #fff7e6; color: #d46b08; border: 1px solid #ffd591; }
</style>




