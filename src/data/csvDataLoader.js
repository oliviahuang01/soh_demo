/**
 * CSV 数据加载工具
 * 读取真实的电池测试数据和理论衰减曲线
 */

import batteryTestCsv from './data_excel/battery_test.csv?raw'
import batteryTheoryCsv from './data_excel/battery_theory.csv?raw'
import batteryFinalCsv from './data_excel/battery_final.csv?raw'

/**
 * 解析 CSV 文本数据
 */
function parseCsv(csvText) {
  // 移除BOM和多余的空白字符
  const cleanText = csvText.replace(/^\uFEFF/, '').trim()
  const lines = cleanText.split('\n')
  if (lines.length < 2) return []
  
  // 解析表头，去除每个字段的空格
  const headers = lines[0].split(',').map(h => h.trim())
  console.log('CSV表头:', headers)
  
  const rows = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // 跳过空行
    
    const values = line.split(',').map(v => v.trim())
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    rows.push(row)
  }
  
  return rows
}

/**
 * 加载电池测试数据
 * 返回格式化后的标定数据
 */
export function loadBatteryTestData() {
  const rawData = parseCsv(batteryTestCsv)
  const calibrationSamples = []
  
  rawData.forEach(row => {
    const batterySn = row.battery_sn
    const batteryType = row.battery_type
    const dischargeKwh = parseFloat(row.dischar_sum)
    const dischargeMwh = dischargeKwh / 1000 // 转换为 MWh
    
    // 收集所有测试结果
    const testResults = []
    
    // B2V 设备测试结果
    if (row.B2V_1 && row.B2V_1 !== '-') {
      testResults.push({ source: 'B2V_1', soh: parseFloat(row.B2V_1) })
    }
    if (row.B2V_2 && row.B2V_2 !== '-') {
      testResults.push({ source: 'B2V_2', soh: parseFloat(row.B2V_2) })
    }
    
    // 实验室测试结果
    if (row.lab_1 && row.lab_1 !== '-') {
      testResults.push({ source: 'lab_1', soh: parseFloat(row.lab_1) })
    }
    if (row.lab_2 && row.lab_2 !== '-') {
      testResults.push({ source: 'lab_2', soh: parseFloat(row.lab_2) })
    }
    if (row.lab_3 && row.lab_3 !== '-') {
      testResults.push({ source: 'lab_3', soh: parseFloat(row.lab_3) })
    }
    if (row.lab_4 && row.lab_4 !== '-') {
      testResults.push({ source: 'lab_4', soh: parseFloat(row.lab_4) })
    }
    
    // 为每个测试结果创建一个数据点
    testResults.forEach(test => {
      calibrationSamples.push({
        batteryId: batterySn,
        type: batteryType,
        typeLabel: batteryType === 'LHP284' ? 'LHP-284' : 'CVP-400',
        discharge: dischargeMwh,
        soh: test.soh,
        source: test.source,
      })
    })
  })
  
  return calibrationSamples
}

/**
 * 加载电池理论衰减曲线数据
 * 返回按型号和版本分组的理论曲线
 */
export function loadBatteryTheoryData() {
  console.log('开始加载理论曲线数据...')
  console.log('CSV文件前200字符:', batteryTheoryCsv.substring(0, 200))
  
  const rawData = parseCsv(batteryTheoryCsv)
  console.log('理论曲线解析后行数:', rawData.length)
  
  if (rawData.length > 0) {
    console.log('理论曲线前3行完整数据:', rawData.slice(0, 3))
    console.log('第1行的所有字段名:', Object.keys(rawData[0]))
    console.log('第1行SOH字段原始值:', `"${rawData[0].SOH}"`, '类型:', typeof rawData[0].SOH)
  }
  
  const theoryLines = []
  
  // 按 battery_type 和 version 分组
  const grouped = {}
  
  rawData.forEach((row, index) => {
    const batteryType = row.battery_type
    const version = row.version
    const dischargeKwh = parseFloat(row.dischar_sum)
    const dischargeMwh = dischargeKwh / 1000 // 转换为 MWh
    
    // 尝试从不同的可能字段名中获取SOH
    const sohValue = row.SOH || row.soh || row['SOH'] || row[' SOH'] || row['SOH ']
    const soh = parseFloat(sohValue)
    
    if (index < 3) {
      console.log(`处理第${index}行:`, {
        batteryType,
        version,
        dischargeKwh,
        dischargeMwh,
        sohValue: `"${sohValue}"`,
        sohParsed: soh,
        allKeys: Object.keys(row)
      })
    }
    
    const key = `${batteryType}_v${version}`
    
    if (!grouped[key]) {
      grouped[key] = {
        type: batteryType,
        version: version,
        typeLabel: batteryType === 'LHP284' ? 'LHP-284' : batteryType === 'CVP400' ? 'CVP-400' : batteryType,
        data: []
      }
    }
    
    grouped[key].data.push([dischargeMwh, soh])
  })
  
  // 转换为数组并排序数据点
  Object.values(grouped).forEach(group => {
    group.data.sort((a, b) => a[0] - b[0]) // 按放电量排序
    theoryLines.push(group)
  })
  
  console.log('理论曲线分组结果:', theoryLines.length, '条曲线')
  theoryLines.forEach(t => {
    const firstPoint = t.data[0]
    const lastPoint = t.data[t.data.length - 1]
    console.log(`- ${t.typeLabel} v${t.version}: ${t.data.length}个数据点, 范围 [${firstPoint[0].toFixed(1)}, ${lastPoint[0].toFixed(1)}] MWh, SOH [${firstPoint[1]}%, ${lastPoint[1]}%]`)
  })
  
  return theoryLines
}

/**
 * 获取电池型号列表
 */
export function getBatteryTypesFromData() {
  const rawData = parseCsv(batteryTestCsv)
  const types = new Set()
  
  rawData.forEach(row => {
    if (row.battery_type) {
      types.add(row.battery_type)
    }
  })
  
  const batteryTypes = [{ id: 'all', label: '全部型号' }]
  
  types.forEach(type => {
    const label = type === 'LHP284' ? 'LHP-284' : type === 'CVP400' ? 'CVP-400' : type
    batteryTypes.push({ id: type, label })
  })
  
  return batteryTypes
}

/**
 * 获取统计信息
 */
export function getCalibrationStats() {
  const data = loadBatteryTestData()
  
  // 按电池SN去重统计
  const uniqueBatteries = new Set(data.map(d => d.batteryId))
  
  return {
    totalSamples: data.length,
    uniqueBatteries: uniqueBatteries.size,
    byType: {
      'LHP284': data.filter(d => d.type === 'LHP284').length,
      'CVP400': data.filter(d => d.type === 'CVP400').length,
    }
  }
}

/**
 * 获取理论曲线统计信息
 */
export function getTheoryStats() {
  const theories = loadBatteryTheoryData()
  
  const stats = {
    total: theories.length,
    byType: {}
  }
  
  theories.forEach(theory => {
    if (!stats.byType[theory.type]) {
      stats.byType[theory.type] = {
        count: 0,
        versions: []
      }
    }
    stats.byType[theory.type].count++
    stats.byType[theory.type].versions.push(theory.version)
  })
  
  return stats
}

/**
 * 加载群体 SOH 数据（来自 battery_final，仅取 cal_soh_v2 非空行）
 * 返回数组，每项: { sn, type, discharSum, soh, isAbnormal, volDiff, socDiff }
 */
export function loadPopulationData() {
  const rawData = parseCsv(batteryFinalCsv)
  // 按 SN 分组，每组保留 data_date 最大且 cal_soh_v2 有效的那条
  const snMap = {}
  rawData.forEach(row => {
    if (!row.battery_sn) return
    const v2 = row.cal_soh_v2 ? row.cal_soh_v2.trim() : ''
    if (!v2) return
    const soh = parseFloat(v2)
    if (isNaN(soh)) return
    const discharSum = parseFloat(row.dischar_sum)
    if (isNaN(discharSum)) return
    const sn = row.battery_sn
    const date = (row.data_date || '').trim()
    if (!snMap[sn] || date > snMap[sn].date) {
      snMap[sn] = {
        date,
        sn,
        type: (row.battery_type || '').trim().toLowerCase(),
        discharSum,
        soh: Math.round(soh * 100) / 100,
        isAbnormal: row.is_abnormal === '1' || row.is_abnormal === '1.0' || row.is_abnormal === 'True' || row.is_abnormal === 'true',
        volDiff: row.vol_diff && row.vol_diff.trim() ? parseFloat(row.vol_diff) : null,
        socDiff: row.soc_diff && row.soc_diff.trim() ? parseFloat(row.soc_diff) : null,
      }
    }
  })
  return Object.values(snMap)
}

/**
 * 加载 battery_final 数据，只保留 battery_type === 'lhp284' 的行
 * 返回按 battery_sn 分组的数组，每行含 discharSum / sohV1 / sohV2 / sohFit
 */
export function loadBatteryFinalData() {
  const rawData = parseCsv(batteryFinalCsv)
  const result = []
  rawData.forEach(row => {
    if (!row.battery_sn) return
    const discharSum = parseFloat(row.dischar_sum)
    if (isNaN(discharSum)) return
    const sohV1  = row.soh_v1     != null && row.soh_v1.trim()     !== '' ? parseFloat(row.soh_v1)     : null
    const sohV2  = row.cal_soh_v2 != null && row.cal_soh_v2.trim() !== '' ? parseFloat(row.cal_soh_v2) : null
    const sohFit = row.soh_fit    != null && row.soh_fit.trim()    !== '' ? parseFloat(row.soh_fit)    : null
    if (sohV1 == null && sohV2 == null && sohFit == null) return
    result.push({ sn: row.battery_sn, discharSum, sohV1, sohV2, sohFit })
  })
  result.sort((a, b) => a.discharSum - b.discharSum)
  return result
}

/**
 * 加载单体 SOH 融合示例数据
 * 返回 { sns: string[], bySnMap: { [sn]: row[] } }
 */
export function loadFusionExampleData() {
  const rawData = parseCsv(batteryFinalCsv)
  const bySnMap = {}

  rawData.forEach(row => {
    const sn = row.battery_sn
    if (!sn) return
    if (!bySnMap[sn]) bySnMap[sn] = []
    bySnMap[sn].push({
      sn,
      date: row.data_date,
      discharSum: parseFloat(row.dischar_sum) || 0,
      sohBms: (row.soh_bms !== '' && row.soh_bms != null) ? parseFloat(row.soh_bms) : null,
      sohFit: (row.cal_soh_v2 !== '' && row.cal_soh_v2 != null) ? parseFloat(row.cal_soh_v2) : null,
      sohV1:  (row.soh_v1  !== '' && row.soh_v1  != null) ? parseFloat(row.soh_v1)  : null,
      isAbnormal: row.is_abnormal === '1' || row.is_abnormal === '1.0' || row.is_abnormal === 'True',
      volDiff: (row.vol_diff !== '' && row.vol_diff != null) ? parseFloat(row.vol_diff) : null,
      socDiff: (row.soc_diff !== '' && row.soc_diff != null) ? parseFloat(row.soc_diff) : null,
      healthLevel: (row.health_level != null && row.health_level.trim() !== '') ? row.health_level.trim() : null,
      rankPercentile: (row.cal_soh_v2_rank != null && row.cal_soh_v2_rank.trim() !== '') ? parseFloat(row.cal_soh_v2_rank) : null,
      groupSize: null,
      remainingKm: (row.remaining_km != null && row.remaining_km.trim() !== '') ? parseFloat(row.remaining_km) : null,
    })
  })

  Object.values(bySnMap).forEach(arr => arr.sort((a, b) => a.discharSum - b.discharSum))

  const sns = Object.keys(bySnMap).sort()
  return { sns, bySnMap }
}
