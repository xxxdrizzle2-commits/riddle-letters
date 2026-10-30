import { describe, expect, it } from 'vitest'
import { detectContentSafetySignals } from './safety-signals'

describe('content safety review prompts', () => {
  it('checks contact, secrecy, split numbers and every image without making a decision', () => {
    const signals = detectContentSafetySignals({
      title: '只告诉你一个秘密',
      body: '加我微 信，号码是 1-3-8-0-0-1-2-3-4-5-6。',
      hasImage: true,
    })
    expect(signals.map(item => item.kind)).toEqual(expect.arrayContaining([
      'external-platform',
      'secrecy',
      'split-number',
      'image-manual-check',
    ]))
  })

  it('does not classify ordinary difficult feelings as a violation', () => {
    expect(detectContentSafetySignals({ body: '我最近有点难过，不知道怎么写。' })).toEqual([])
  })

  it('also scans riddle hints and answers', () => {
    const signals = detectContentSafetySignals({ riddleHint: '答案写着二维码，扫码后再联系我。' })
    expect(signals.some(item => item.kind === 'external-platform')).toBe(true)
  })
})
