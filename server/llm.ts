import type { AggregatedAnalysis } from './types.js'

function buildReportPrompt(data: AggregatedAnalysis): string {
  const { summary, ruleReport, ruleMatrix } = data

  const ruleIds = [...new Set(ruleReport.map(r => r.ruleId))]
  const runs = [...new Set(ruleMatrix.map(r => r.runIndex))].sort((a, b) => a - b)

  let matrixStr = '规则判定矩阵 (x=不满足, √=满足, -=不涉及):\n'
  matrixStr += '规则\t' + runs.map(r => `Run${r}`).join('\t') + '\t不满足率\t稳定性\n'
  for (const ruleId of ruleIds) {
    const report = ruleReport.find(r => r.ruleId === ruleId)
    const row = runs.map(runIdx => {
      const cell = ruleMatrix.find(c => c.ruleId === ruleId && c.runIndex === runIdx)
      if (!cell) return '-'
      if (cell.result === '满足') return '√'
      if (cell.result === '不满足') return 'x'
      return '-'
    })
    matrixStr += `${ruleId}\t${row.join('\t')}\t${report?.unsatisfiedRate ?? 0}%\t${report?.stability || ''}\n`
  }

  let conclusionsStr = ''
  for (const rule of ruleReport) {
    conclusionsStr += `\n### ${rule.ruleId} (${rule.stability}, 不满足率${rule.unsatisfiedRate}%)\n`
    conclusionsStr += `规则定义：${rule.summary.slice(0, 300)}\n\n`
    const passRuns: number[] = []
    const failRuns: number[] = []
    for (const runIdx of runs) {
      const cell = ruleMatrix.find(c => c.ruleId === rule.ruleId && c.runIndex === runIdx)
      if (cell && cell.result === '满足') passRuns.push(runIdx)
      if (cell && cell.result === '不满足') failRuns.push(runIdx)
    }
    conclusionsStr += `判定为满足的 Run: ${passRuns.map(r => 'Run' + r).join(', ') || '无'}\n`
    conclusionsStr += `判定为不满足的 Run: ${failRuns.map(r => 'Run' + r).join(', ') || '无'}\n\n`
    for (const runIdx of runs) {
      const cell = ruleMatrix.find(c => c.ruleId === rule.ruleId && c.runIndex === runIdx)
      if (cell && cell.result !== '不涉及') {
        conclusionsStr += `Run${runIdx}(${cell.result}): "${cell.conclusion}"\n`
      }
    }
  }

  return `你是一个代码评分一致性分析专家。以下是某任务 ${summary.completedRuns} 次AI评分运行的规则判定结果，同一份代码由同一个评分agent运行了多次，所有判定差异都来自agent本身的不稳定性。

总体统计：平均${summary.averageScore}分，标准差${summary.scoreStandardDeviation}，一致性${summary.consistencyPercentage}%

${matrixStr}

以下是每条规则在各次运行中的详细判定理由：

${conclusionsStr}

请严格按照以下格式，对每一条存在波动的规则（至少有1次pass和1次fail的规则）逐一分析。分析要具体到每次run的判定理由原文，指出评分agent的解读分歧点。

输出格式要求（不要添加额外章节，直接按下面格式输出）：

---

## 总体波动概况
（简要说明10条规则中多少条存在波动，波动整体严重程度）

---

然后对每一条波动的规则，按不满足率从高到低输出以下格式的分析：

## {规则ID}
**判定结果**：Run{xx}(满足) / Run{yy}(不满足) / ...
**稳定性**：{稳定性}

Run{满足的run编号} 中 **{规则ID}** 被判定为"满足"，评分agent的判定理由是：
（引用该run的conclusion原文，用你自己的话转述评分agent看到了什么代码、做了什么判断、为什么认为满足）

而在 Run{不满足的run编号} 中，评分agent对同一份代码做出了不同的解读：
（引用这些run的conclusion原文，转述评分agent为什么认为不满足）

**波动原因**：这是评分agent对"{用一句话概括分歧点，如'GridRow gutter是否必需'}"的判定边界理解不一致导致的波动 — Run{xx}采用了宽松解读（{一句话概括宽松理由}），而Run{yy}采用了严格解读（{一句话概括严格理由}）。

---

示例（CMP-SHOULD-06的期望输出格式）：

## CMP-SHOULD-06
**判定结果**：Run1/2/3/6/9(满足) / Run4/5/7/8/10(不满足)
**稳定性**：判定波动

Run1 中 **CMP-SHOULD-06** 被判定为"满足"，原因如下：
评分agent认为HomeTab.ets中有两个GridRow：
1. 第213行的内层GridRow（课程列表）— 已显式配置gutter: {x:12, y:12}，满足规则
2. 第20行的外层GridRow（主布局）— 未配置gutter，但使用了padding控制间距
Agent判定逻辑是：外层GridRow虽然没有配置gutter，但它通过padding实现了间距效果，认为"未违反规则核心意图"，因此整体判定为"满足"。

而在 Run4/5/7/8/10 中，评分agent对同一份代码做出了更严格的解读：认为外层GridRow缺少gutter就是违规，padding不能替代gutter的栅格间距功能。

**波动原因**：这是评分agent对"GridRow gutter是否必需"的判定边界理解不一致导致的波动 — Run1采用了宽松解读（有间距手段即可），后续部分run采用了严格解读（必须显式配置gutter）。

---

请严格按照以上格式对所有波动规则逐一分析，每条规则都要有具体的conclusion引用和分歧点分析。`
}

function buildDiagnosePrompt(data: AggregatedAnalysis, ruleId: string): string {
  const rule = data.ruleReport.find(r => r.ruleId === ruleId)
  if (!rule) throw new Error(`Rule ${ruleId} not found`)

  const cells = data.ruleMatrix.filter(c => c.ruleId === ruleId).sort((a, b) => a.runIndex - b.runIndex)

  let runDetailsStr = ''
  for (const cell of cells) {
    runDetailsStr += `Run${cell.runIndex} (${cell.result}): "${cell.conclusion}"\n\n`
  }

  return `你是一个代码评分规则分析专家。以下是规则 ${ruleId} 在 ${data.summary.completedRuns} 次运行中的判定详情：

规则定义：${rule.summary}
不满足率：${rule.unsatisfiedRate}%
稳定性：${rule.stability}

各次运行的判定结果和理由：
${runDetailsStr}

请用中文深入分析这条规则判定不一致的原因，格式如下：

## 判定模式
描述波动模式（如"Run1-3宽松判定为满足，Run4-10中部分严格判定为不满足"）

## 根本原因
分析评分agent的解读差异：
1. 宽松解读时agent认为什么条件就满足了？（引用具体conclusion）
2. 严格解读时agent认为什么条件才算满足？（引用具体conclusion）
3. 两者的分歧点在哪里？

## 规则边界分析
这条规则的描述是否有模糊空间？哪些边界条件需要更明确的定义？

## 建议
为了消除这条规则的判定波动，建议对规则描述做什么修改？`
}

export async function callGlm(prompt: string): Promise<string> {
  const apiKey = process.env.GLM_API_KEY || ''
  const model = process.env.GLM_MODEL || 'glm-4-flash'

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GLM API error: ${response.status} ${text}`)
  }

  const result = await response.json() as any
  return result.choices?.[0]?.message?.content || ''
}

export function generateReport(data: AggregatedAnalysis): Promise<string> {
  const prompt = buildReportPrompt(data)
  return callGlm(prompt)
}

export function diagnoseRule(data: AggregatedAnalysis, ruleId: string): Promise<string> {
  const prompt = buildDiagnosePrompt(data, ruleId)
  return callGlm(prompt)
}
