import { loadPopulationData, loadBatteryTestData, loadBatteryTheoryData } from './csvDataLoader.js'

/** 电池型号 */
export const BATTERY_TYPES = [
  { id: 'all', label: '全部型号' },
  { id: 'LFP-280', label: 'LHP-284' },
  { id: 'LFP-314', label: 'CVP-400' },
  { id: 'NCM-280', label: '宁德-282 / BC3' },
]

/** 顶部总指标（从 battery_final.csv 动态计算） */
export function getOverviewMetrics() {
  const data = loadPopulationData()
  const total = data.length
  const types = new Set(data.map(d => d.type)).size
  const abnormal = data.filter(d => d.isAbnormal).length
  const calSamples = new Set(loadBatteryTestData().map(d => d.batteryId)).size

  return [
    { key: 'totalBatteries',     label: '累计计算电池', value: total,      unit: '套', icon: 'battery' },
    { key: 'batteryTypes',       label: '覆盖电池型号', value: types,      unit: '类', icon: 'types' },
    { key: 'abnormalBatteries',  label: '异常识别电池', value: abnormal,   unit: '套', icon: 'warning', highlight: true },
    { key: 'algorithmVersions',  label: '算法累计版本', value: 3,          unit: '个', icon: 'version' },
    { key: 'calibrationSamples', label: '实测标定样本', value: calSamples, unit: '套', icon: 'calibration' },
  ]
}

/** 算法版本信息 */
export const ALGORITHM_VERSIONS = [
  {
    id: 'V1',
    name: 'V1',
    time: '2024',
    status: 'released',
    title: '基于两点法的 SOH 估计',
    description: '利用充放电起止两点电压与容量信息，建立线性衰减模型，实现快速 SOH 初估。适用于早期批量筛查场景。',
  },
  {
    id: 'V2',
    name: 'V2',
    time: '2025',
    status: 'released',
    title: '基于静态电压的 SOH 估计',
    description: '引入静态 SOC-OCV 曲线映射，结合历史运行数据修正，提升低倍率工况下的估计精度。',
  },
  {
    id: 'Fusion',
    name: 'Fusion',
    time: '2026',
    status: 'released',
    title: '多模型融合与结果平滑',
    description: '融合 V1/V2 多源估计结果，采用卡尔曼平滑与异常值剔除策略，输出稳定可靠的群体 SOH 曲线。',
  },
  {
    id: 'V3',
    name: 'V3',
    time: '2026 Q4',
    status: 'developing',
    title: '基于动态电压的 SOH 估计',
    description: '利用充放电动态电压响应特征，构建时序学习模型，目标在复杂工况下实现更高精度 SOH 追踪。（开发中）',
  },
]

// ─────────────────────────────────────────────────────────────
// 理论衰减曲线外观配置
// key 格式：{battery_type}_{version}，与 battery_theory.csv 对应
// BC3 version=1 为 25°C，version=2 为 45°C
// ─────────────────────────────────────────────────────────────

const CURVE_META = {
  LHP284_1: { name: 'LHP-284 理论衰减 (45°C)', color: '#52c41a', lineType: 'dashed',  typeFilter: ['all', 'LFP-280'] },
  CVP400_1: { name: 'CVP-400 理论衰减 (v1)',   color: '#13c2c2', lineType: 'dashed',  typeFilter: ['all', 'LFP-314'] },
  BC3_1:    { name: '宁德-282 理论衰减 (25°C)', color: '#fa8c16', lineType: 'dashed',  typeFilter: ['all', 'NCM-280'] },
  BC3_2:    { name: '宁德-282 理论衰减 (45°C)', color: '#fa8c16', lineType: 'dotted',  typeFilter: ['all', 'NCM-280'] },
}

/**
 * 返回散点图所需的理论衰减曲线，数据来自 battery_theory.csv。
 * 返回格式：[{ name, color, lineType, data: [[MWh, soh], …] }]
 */
export function getTheoreticalLines(typeFilter = 'all') {
  const csvLines = loadBatteryTheoryData()
  const lines = []

  csvLines.forEach(({ type, version, data }) => {
    const key = `${type}_${version}`
    const meta = CURVE_META[key]
    if (!meta) return
    if (!meta.typeFilter.includes(typeFilter)) return
    lines.push({ name: meta.name, color: meta.color, lineType: meta.lineType, data })
  })

  return lines
}

/** Health tier for display styling */
export function getSohTier(soh) {
  if (soh >= 90) return { label: '优', colorClass: 'success' }
  if (soh >= 80) return { label: '良', colorClass: 'info' }
  if (soh >= 70) return { label: '注意', colorClass: 'warning' }
  return { label: '预警', colorClass: 'danger' }
}
