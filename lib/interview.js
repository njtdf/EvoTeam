import { chatStream, hasApiKey } from './ai.js'

// F20: AI Interview / Defense Practice
// Scenarios: thesis defense, project defense, job interview, general Q&A

const SCENARIOS = {
  thesis_defense: {
    label: '学位论文答辩',
    desc: 'AI 扮演答辩委员会考官，针对学生的研究方向提出深度问题',
  },
  project_defense: {
    label: '项目答辩',
    desc: 'AI 扮演项目评审专家，针对项目的技术路线、创新性、可行性提问',
  },
  job_interview: {
    label: '求职面试',
    desc: 'AI 扮演企业面试官，进行行为面试 + 技术面试',
  },
  qa_practice: {
    label: '通用问答练习',
    desc: 'AI 自由提问，适合日常表达训练',
  },
}

function buildSystemPrompt(scenario, topic, context) {
  const ctx = context ? `\n背景信息：${context}` : ''
  const t = topic ? `\n面试主题：${topic}` : ''

  const bases = {
    thesis_defense: `你是一位资深学位论文答辩委员会考官（IEEE Fellow 级别，30 年评审经验）。
你的任务是对学生进行模拟答辩，要求：${t}${ctx}

规则：
1. 每次只提一个问题，问题要具体、有深度，直击研究的关键假设或方法选择
2. 问题维度包括：创新性、方法论、实验设计、相关工作对比、局限性、数据质量、理论推导
3. 学生回答后，先给 1-2 句简短点评（好在哪里、缺什么），再提下一个问题
4. 共提 5-7 个问题，最后给一个总结评价（通过/修改后通过/不通过 + 理由）
5. 用中文提问和点评，技术术语可中英混用
6. 语气专业、严肃但不刻薄`,

    project_defense: `你是一位项目评审专家组组长（国家自然科学基金/重点研发计划级别）。
你的任务是对项目负责人进行模拟项目答辩，要求：${t}${ctx}

规则：
1. 每次只提一个问题，覆盖：技术路线合理性、创新性、可行性、预期成果、经费预算、团队构成、风险应对
2. 学生/负责人回答后，先给简短点评，再提下一个问题
3. 共提 5-7 个问题，最后给总结评价和改进建议
4. 如果用户要求"推荐回答"，切换到教练模式：分析问题意图，给出 2-3 种回答策略及示例话术
5. 用中文，技术术语可中英混用`,

    job_interview: `你是一位企业技术面试官（华为/阿里/国家电网级别）。
你的任务是对求职者进行模拟面试，要求：${t}${ctx}

规则：
1. 每次只提一个问题，交替进行行为面试（STAR 法则）和技术面试
2. 候选人回答后，先给简短点评，再提下一个问题
3. 共提 5-7 个问题，最后给总结评价（录用/待定/不录用 + 理由）
4. 用中文，技术术语可中英混用`,

    qa_practice: `你是一位学术讨论伙伴，擅长通过提问引导学生深入思考。
你的任务是与学生进行问答练习，要求：${t}${ctx}

规则：
1. 每次只提一个问题，问题要有启发性
2. 学生回答后，先给简短反馈，再提下一个问题
3. 用中文`,
  }

  return bases[scenario] || bases.qa_practice
}

export function getScenarios() {
  return Object.entries(SCENARIOS).map(([key, val]) => ({ key, ...val }))
}

export async function startInterview({ scenario, topic, context }, onChunk) {
  if (!hasApiKey()) {
    onChunk('(AI 功能未配置 - 缺少 DEEPSEEK_API_KEY)')
    return '(no_api_key)'
  }
  const systemPrompt = buildSystemPrompt(scenario, topic, context)
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请开始面试/答辩，提出第一个问题。' },
  ]
  return await chatStream(messages, onChunk)
}

export async function continueInterview({ scenario, topic, context, history, answer, coachMode }, onChunk) {
  if (!hasApiKey()) {
    onChunk('(AI 功能未配置 - 缺少 DEEPSEEK_API_KEY)')
    return '(no_api_key)'
  }
  let systemPrompt = buildSystemPrompt(scenario, topic, context)
  if (coachMode) {
    systemPrompt += '\n\n当前模式：教练模式。用户希望你分析刚才的问题并给出推荐回答策略。请：1) 分析问题意图 2) 给出 2-3 种回答策略 3) 每种策略附示例话术。'
  }
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: coachMode ? '请分析上一个问题并给出推荐回答。' : answer },
  ]
  return await chatStream(messages, onChunk)
}

export function apply(ctx, config) {
  ctx.interview = { getScenarios, startInterview, continueInterview }
}
