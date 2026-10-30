export type SafetySignalKind =
  | 'contact-request'
  | 'external-platform'
  | 'secrecy'
  | 'gift-or-meeting'
  | 'location-detail'
  | 'split-number'
  | 'image-manual-check'

export interface SafetySignal {
  kind: SafetySignalKind
  label: string
  evidence: string
}

type ContentForSafetyCheck = {
  title?: string
  body?: string
  riddleQuestion?: string
  riddleHint?: string
  riddleAnswer?: string
  hasImage?: boolean
}

const rules: { kind: SafetySignalKind; label: string; pattern: RegExp }[] = [
  {
    kind: 'contact-request',
    label: '可能在索要或提供私人联系方式',
    pattern: /(?:联系方式|手机号|电话号码|电话|邮箱|电子邮件|加我|联系我)/iu,
  },
  {
    kind: 'external-platform',
    label: '可能在引导转到站外平台',
    pattern: /(?:微信|微\s*信|v\s*[x信]|we\s*chat|q\s*q|抖音|小红书|微博|群聊|二维码)/iu,
  },
  {
    kind: 'secrecy',
    label: '可能在诱导保密',
    pattern: /(?:不要告诉|别告诉|替我保密|我们的秘密|只告诉[你我]|瞒着老师|瞒着家长)/iu,
  },
  {
    kind: 'gift-or-meeting',
    label: '可能涉及送礼、私下见面或线下接触',
    pattern: /(?:送你礼物|给你买|寄礼物|单独见面|私下见|来找我|我去找你|约个地方)/iu,
  },
  {
    kind: 'location-detail',
    label: '可能包含精确住址或学校位置',
    pattern: /(?:住址|详细地址|门牌号|几栋几单元|哪所学校|学校地址|家庭地址)/iu,
  },
  {
    kind: 'split-number',
    label: '可能用拆分数字表达联系方式',
    pattern: /(?:\d[\s._-]*){7,}/u,
  },
]

function compactEvidence(value: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 12)
  const end = Math.min(value.length, matchIndex + 28)
  return value.slice(start, end).replace(/\s+/gu, ' ').trim()
}

/**
 * Returns review prompts, never an automated moderation decision.
 * A missing signal does not mean that content is safe.
 */
export function detectContentSafetySignals(content: ContentForSafetyCheck): SafetySignal[] {
  const fields = [
    ['标题', content.title],
    ['正文', content.body],
    ['谜语题面', content.riddleQuestion],
    ['谜语提示', content.riddleHint],
    ['谜语答案', content.riddleAnswer],
  ] as const
  const signals: SafetySignal[] = []
  const seen = new Set<SafetySignalKind>()

  for (const [field, raw] of fields) {
    if (!raw) continue
    for (const rule of rules) {
      if (seen.has(rule.kind)) continue
      const match = rule.pattern.exec(raw)
      rule.pattern.lastIndex = 0
      if (!match) continue
      seen.add(rule.kind)
      signals.push({ kind: rule.kind, label: rule.label, evidence: `${field}：${compactEvidence(raw, match.index)}` })
    }
  }

  if (content.hasImage) {
    signals.push({
      kind: 'image-manual-check',
      label: '图片需人工检查文字、二维码、边角和隐私信息',
      evidence: '自动文字规则无法证明图片安全。',
    })
  }
  return signals
}
