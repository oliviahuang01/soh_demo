<script setup>
import { ref, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BoxplotChart, ScatterChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import {
  ALGORITHM_VERSIONS,
} from '../data/mockData.js'
import {
  loadBatteryTestData,
  getBatteryTypesFromData,
  loadBatteryTheoryData,
  loadBatteryFinalData,
} from '../data/csvDataLoader.js'

use([
  CanvasRenderer,
  BoxplotChart,
  ScatterChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
])

const activeVersion = ref('V1')
const selectedCalType = ref('all')
const allFinalData = loadBatteryFinalData()
const allCalibrationData = loadBatteryTestData()
const allTheoryData = loadBatteryTheoryData()
const BATTERY_TYPES = getBatteryTypesFromData()

// 调试输出
console.log('===== 数据加载调试信息 =====')
console.log('实测数据点数:', allCalibrationData.length)
console.log('理论曲线数:', allTheoryData.length)
console.log('理论曲线详情:', allTheoryData.map(t => ({
  type: t.type,
  typeLabel: t.typeLabel,
  version: t.version,
  dataPoints: t.data.length
})))
console.log('电池型号选项:', BATTERY_TYPES)
console.log('===========================')

const selectedVersionInfo = computed(
  () => ALGORITHM_VERSIONS.find((v) => v.id === activeVersion.value) ?? ALGORITHM_VERSIONS[0]
)

const filteredCalibrationData = computed(() => {
  if (selectedCalType.value === 'all') return allCalibrationData
  return allCalibrationData.filter(d => d.type === selectedCalType.value)
})

const filteredTheoryData = computed(() => {
  const filtered = selectedCalType.value === 'all' 
    ? allTheoryData 
    : allTheoryData.filter(d => d.type === selectedCalType.value)
  
  console.log(`理论曲线筛选: ${selectedCalType.value}, 结果: ${filtered.length}条`)
  return filtered
})

const calSampleCount = computed(() => filteredCalibrationData.value.length)

function buildBoxplotData() {
  const data = allFinalData
  if (!data.length) return {}

  // 按 discharSum 分 bin（步长 50000 kWh = 5万kWh）
  const BIN_SIZE = 50000
  const maxDischar = Math.max(...data.map(d => d.discharSum))
  const binEdges = []
  for (let b = BIN_SIZE; b <= maxDischar + BIN_SIZE; b += BIN_SIZE) binEdges.push(b)

  const versions = [
    { key: 'sohV1',  label: 'V1',     color: '#1677ff' },
    { key: 'sohV2',  label: 'V2',     color: '#722ed1' },
    { key: 'sohFit', label: 'Fusion', color: '#13c2c2' },
  ]

  function makeBoxData(vals) {
    if (!vals.length) return null
    const sorted = [...vals].sort((a, b) => a - b)
    const n = sorted.length
    const q1 = sorted[Math.floor(n * 0.25)]
    const q2 = sorted[Math.floor(n * 0.5)]
    const q3 = sorted[Math.floor(n * 0.75)]
    return [sorted[0], q1, q2, q3, sorted[n - 1]]
  }

  const series = versions.map(ver => {
    const boxData = binEdges.map(edge => {
      const lo = edge - BIN_SIZE
      const vals = data
        .filter(d => d.discharSum > lo && d.discharSum <= edge && d[ver.key] != null)
        .map(d => d[ver.key])
      return makeBoxData(vals)
    })
    return {
      name: ver.label,
      type: 'boxplot',
      itemStyle: { color: ver.color, borderColor: ver.color, opacity: 0.7 },
      data: boxData,
    }
  })

  const xLabels = binEdges.map(e => {
    const lo = (e - BIN_SIZE) / 10000
    const hi = e / 10000
    return `${lo}–${hi}万`
  })

  return {
    tooltip: {
      trigger: 'item',
      formatter(params) {
        if (!Array.isArray(params.value)) return ''
        const [min, q1, median, q3, max] = params.value
        return [
          `<b>${params.seriesName}</b>`,
          `累计放电量区间: ${xLabels[params.dataIndex]} kWh`,
          `中位数: ${median?.toFixed(1)}%`,
          `Q1–Q3: ${q1?.toFixed(1)}% – ${q3?.toFixed(1)}%`,
          `范围: ${min?.toFixed(1)}% – ${max?.toFixed(1)}%`,
        ].join('<br/>')
      },
    },
    legend: { data: versions.map(v => v.label), bottom: 0 },
    grid: { left: 60, right: 30, top: 30, bottom: 60 },
    xAxis: {
      type: 'category',
      data: xLabels,
      name: '累计放电量 (kWh)',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      name: 'SOH 估计 (%)',
      type: 'value',
      min: 60,
      max: 110,
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    series,
  }
}

const boxplotOption = computed(() => buildBoxplotData())

const calibrationOption = computed(() => {
  const typeColors = {
    'LHP284': '#1677ff',
    'CVP400': '#52c41a',
    'BC3': '#fa8c16',
  }
  
  const theoryLineStyles = [
    { type: 'dashed', width: 2 },
    { type: 'dotted', width: 2 },
    { type: 'solid', width: 1.5 },
  ]
  
  const seriesByTypeAndSource = {}
  
  filteredCalibrationData.value.forEach(d => {
    const isB2V = d.source.startsWith('B2V')
    const category = `${d.type}_${isB2V ? 'B2V' : 'Lab'}`
    
    if (!seriesByTypeAndSource[category]) {
      seriesByTypeAndSource[category] = {
        type: d.type,
        typeLabel: d.typeLabel,
        isB2V,
        data: []
      }
    }
    
    seriesByTypeAndSource[category].data.push(d)
  })
  
  const scatterSeries = Object.values(seriesByTypeAndSource).map(group => ({
    name: `${group.typeLabel} (${group.isB2V ? 'B2V设备' : '委外实验室'})`,
    type: 'scatter',
    symbol: group.isB2V ? 'circle' : 'diamond',
    symbolSize: 10,
    itemStyle: { 
      color: typeColors[group.type],
      opacity: group.isB2V ? 0.8 : 0.6
    },
    data: group.data.map(d => ({
      value: [+(d.discharge * 0.1).toFixed(4), d.soh],
      batteryId: d.batteryId,
      source: d.source,
    })),
    z: 10,
  }))
  
  const theorySeries = filteredTheoryData.value.map((theory, index) => {
    console.log(`创建理论曲线: ${theory.typeLabel} v${theory.version}, 数据点: ${theory.data.length}`)
    return {
      name: `${theory.typeLabel} 理论衰减 v${theory.version}`,
      type: 'line',
      smooth: false,
      showSymbol: false,
      lineStyle: {
        color: typeColors[theory.type],
        ...theoryLineStyles[index % theoryLineStyles.length],
        opacity: 0.7
      },
      data: theory.data.map(([mwh, soh]) => [+(mwh * 0.1).toFixed(4), soh]),
      z: 5,
    }
  })
  
  const allSeries = [...scatterSeries, ...theorySeries]
  
  console.log(`图表系列总数: ${allSeries.length} (散点: ${scatterSeries.length}, 曲线: ${theorySeries.length})`)
  
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.componentSubType === 'line') {
          const [discharge, soh] = params.value
          return [
            `<b>${params.seriesName}</b>`,
            `SOH: ${soh}%`,
            `累计放电量: ${discharge.toFixed(2)} 万kWh`,
          ].join('<br/>')
        } else {
          const [discharge, soh] = params.value
          const batteryId = params.data.batteryId
          const source = params.data.source
          const sourceLabel = source.startsWith('B2V') ? `B2V设备 (${source})` : `委外实验室 (${source})`
          return [
            `<b>${batteryId}</b>`,
            `测试来源: ${sourceLabel}`,
            `SOH: ${soh}%`,
            `累计放电量: ${discharge.toFixed(2)} 万kWh`,
          ].join('<br/>')
        }
      },
    },
    legend: {
      data: allSeries.map(s => s.name),
      bottom: 0,
      type: 'scroll',
    },
    grid: { left: 60, right: 30, top: 30, bottom: 100 },
    dataZoom: [
      { type: 'inside' }, 
      { type: 'slider', bottom: 76, height: 18 }
    ],
    xAxis: {
      name: '累计放电量 (万kWh)',
      nameLocation: 'middle',
      nameGap: 30,
      type: 'value',
      min: 0,
      axisLabel: { formatter: v => v.toFixed(1) },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    yAxis: {
      name: 'SOH (%)',
      type: 'value',
      min: 70,
      max: 100,
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    series: allSeries,
  }
})
</script>

<template>
  <div>
    <section class="card roadmap-section">
      <div class="card-header">
        <span class="card-title">算法演进路线图</span>
      </div>
      <div class="card-body">
        <div class="roadmap-track">
          <div
            v-for="ver in ALGORITHM_VERSIONS"
            :key="ver.id"
            class="roadmap-node"
            :class="{
              active: activeVersion === ver.id,
              developing: ver.status === 'developing',
            }"
            @click="activeVersion = ver.id"
          >
            <div class="roadmap-dot" />
            <div class="roadmap-name">{{ ver.name }}</div>
            <div class="roadmap-time">{{ ver.time }}</div>
            <span class="roadmap-badge" :class="{ dev: ver.status === 'developing' }">
              {{ ver.status === 'developing' ? '开发中' : '已发布' }}
            </span>
          </div>
        </div>

        <div class="version-detail">
          <h4>{{ selectedVersionInfo.title }}</h4>
          <p>{{ selectedVersionInfo.description }}</p>
        </div>
      </div>
    </section>

    <section class="card" style="margin-bottom: 24px">
      <div class="card-header">
        <span class="card-title">版本结果对比</span>
        <span style="font-size: 12px; color: #8c8c8c">同一批电池 · V1 / V2 / Fusion SOH 分布</span>
      </div>
      <div class="card-body">
        <VChart class="chart-container-sm" :option="boxplotOption" autoresize />
      </div>
    </section>

    <hr class="section-divider" />

    <section class="card">
      <div class="card-header">
        <span class="card-title">实测标定验证</span>
        <div class="filter-bar">
          <span class="filter-label">电池型号</span>
          <select v-model="selectedCalType" class="select-input">
            <option v-for="t in BATTERY_TYPES" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
          <h3 class="section-title">实测数据与理论衰减曲线对比</h3>
          <span style="font-size: 12px; color: #8c8c8c">{{ calSampleCount }} 个测试数据点</span>
        </div>
        <VChart class="chart-container-sm" :option="calibrationOption" autoresize />
        <div class="calibration-note">
          <strong>说明：</strong>展示各电池型号实测SOH数据与理论衰减曲线的对比。
          <br/>
          <span style="margin-left: 8px">● 圆形标记：B2V设备测试结果</span>
          <span style="margin-left: 16px">◆ 菱形标记：委外实验室测试结果</span>
          <span style="margin-left: 16px">━ 曲线：理论衰减曲线（不同版本用不同线型）</span>
        </div>
      </div>
    </section>
  </div>
</template>
