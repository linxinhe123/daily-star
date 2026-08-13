import { z } from 'zod'

const SourceSchema = z.object({ id: z.string(), title: z.string(), url: z.url() })
const TimelineSchema = z.object({ year: z.string(), title: z.string(), detail: z.string() })
const LicensedImageSchema = z.object({
  kind: z.literal('licensed'), url: z.url(), originalUrl: z.url(), author: z.string().min(1), license: z.string().min(1),
  focus: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
})

export const PlayerProfileSchema = z.object({
  slug: z.string().min(1), name: z.string().min(1), nameZh: z.string().min(1), aliases: z.array(z.string()), nationality: z.string(),
  position: z.string(), era: z.string(), shirtNumbers: z.array(z.number()), summary: z.string().min(1), clues: z.array(z.string()).min(5),
  timeline: z.array(TimelineSchema).min(5), honors: z.array(z.string()), stories: z.array(z.string()),
  recommendedMatches: z.array(z.object({ title: z.string(), date: z.string(), note: z.string() })), facts: z.array(z.string()),
  image: z.union([LicensedImageSchema, z.object({ kind: z.literal('fallback') })]), sources: z.array(SourceSchema).min(1),
})
export const DailyChallengeSchema = z.object({ date: z.string(), clues: z.array(z.string()), attempt: z.number().int(), status: z.enum(['playing', 'won', 'revealed']), choices: z.array(z.string()).optional() })
export const GuessResultSchema = z.object({ correct: z.boolean(), attempt: z.number().int(), status: z.enum(['playing', 'won', 'revealed']), clues: z.array(z.string()), player: PlayerProfileSchema.optional() })
export const AskPlayerInputSchema = z.object({ question: z.string().trim().min(2).max(500) })
export const PlayerAnswerSchema = z.object({ answer: z.string(), citations: z.array(SourceSchema), confidence: z.enum(['low', 'medium', 'high']), mode: z.enum(['archive', 'llm']), opinion: z.boolean() })

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>
export type DailyChallenge = z.infer<typeof DailyChallengeSchema>
export type GuessResult = z.infer<typeof GuessResultSchema>
export type AskPlayerInput = z.infer<typeof AskPlayerInputSchema>
export type PlayerAnswer = z.infer<typeof PlayerAnswerSchema>
