import { describe, expect, it } from 'vitest'
import {
  AskPlayerInputSchema,
  DailyChallengeSchema,
  GuessResultSchema,
  PlayerAnswerSchema,
  PlayerProfileSchema,
} from './index'

const player = {
  slug: 'lionel-messi',
  name: 'Lionel Messi',
  nameZh: '梅西',
  aliases: ['里奥·梅西'],
  nationality: 'Argentina',
  position: 'Forward',
  era: '2004-present',
  shirtNumbers: [10],
  summary: 'An Argentine forward known for close control and playmaking.',
  clues: ['来自阿根廷', '长期身穿 10 号', '赢得世界杯', '惯用左脚', '出自拉玛西亚'],
  timeline: [
    { year: '2004', title: '一线队首秀', detail: '代表巴塞罗那完成正式比赛首秀。' },
    { year: '2009', title: '首夺金球奖', detail: '成为年度金球奖得主。' },
    { year: '2012', title: '年度进球纪录', detail: '创造自然年进球纪录。' },
    { year: '2021', title: '美洲杯冠军', detail: '随阿根廷赢得美洲杯。' },
    { year: '2022', title: '世界杯冠军', detail: '随阿根廷赢得世界杯。' },
  ],
  honors: ['世界杯冠军'],
  stories: ['从拉玛西亚走向世界冠军。'],
  recommendedMatches: [{ title: '2022 世界杯决赛', date: '2022-12-18', note: '世界杯夺冠之战。' }],
  facts: ['成年职业生涯长期身穿 10 号。'],
  image: {
    kind: 'licensed',
    url: 'https://commons.wikimedia.org/example.jpg',
    originalUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    author: 'Example',
    license: 'CC BY-SA 4.0',
    focus: { x: 50, y: 30 },
  },
  sources: [{ id: 'fifa-profile', title: 'FIFA player profile', url: 'https://www.fifa.com/' }],
}

describe('PlayerProfileSchema', () => {
  it('accepts a sourced profile with five clues and licensed image attribution', () => {
    expect(PlayerProfileSchema.parse(player).slug).toBe('lionel-messi')
  })

  it('requires at least five clues', () => {
    expect(() => PlayerProfileSchema.parse({ ...player, clues: player.clues.slice(0, 4) })).toThrow()
  })

  it('requires explicit attribution or a fallback image', () => {
    expect(() => PlayerProfileSchema.parse({ ...player, image: { kind: 'licensed', url: 'x' } })).toThrow()
    expect(PlayerProfileSchema.parse({ ...player, image: { kind: 'fallback' } }).image.kind).toBe('fallback')
  })

  it('requires at least one source', () => {
    expect(() => PlayerProfileSchema.parse({ ...player, sources: [] })).toThrow()
  })
})

describe('API contracts', () => {
  it('validates challenge, guess, ask and answer payloads', () => {
    expect(DailyChallengeSchema.parse({ date: '2026-08-13', clues: ['线索'], attempt: 1, status: 'playing' }).status).toBe('playing')
    expect(GuessResultSchema.parse({ correct: false, attempt: 2, status: 'playing', clues: ['a', 'b'] }).correct).toBe(false)
    expect(AskPlayerInputSchema.parse({ question: '他的技术特点是什么？' }).question).toContain('技术')
    expect(PlayerAnswerSchema.parse({ answer: '擅长盘带。', citations: [], confidence: 'low', mode: 'archive', opinion: false }).mode).toBe('archive')
  })
})
