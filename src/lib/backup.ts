import { z } from 'zod'
import type { Meta, Period } from './types'

const ratio = z.object({ b: z.number().min(0), l: z.number().min(0), d: z.number().min(0) })
const count = z.object({ b: z.number().min(0), l: z.number().min(0), d: z.number().min(0) })

const metaSchema = z.object({
  version: z.literal(1),
  currency: z.string(),
  members: z.array(
    z.object({ id: z.string(), name: z.string(), username: z.string(), active: z.boolean(), createdAt: z.string() }),
  ),
  categories: z.array(z.string()),
  units: z.array(z.string()),
  defaultRatio: ratio,
  periods: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.string() })),
})

const periodSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  ratio,
  memberIds: z.array(z.string()),
  expenses: z.array(
    z.object({
      id: z.string(),
      amount: z.number(),
      description: z.string(),
      quantity: z.number(),
      unit: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      category: z.string(),
      paidBy: z.string(),
      isMeal: z.boolean(),
      participants: z.array(z.string()),
      createdBy: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  meals: z.record(z.string(), z.record(z.string(), count)),
})

const backupSchema = z.object({
  app: z.literal('meal-expenses'),
  exportedAt: z.string(),
  meta: metaSchema,
  periods: z.record(z.string(), periodSchema),
})

export interface Backup {
  app: 'meal-expenses'
  exportedAt: string
  meta: Meta
  periods: Record<string, Period>
}

export function parseBackup(json: unknown): Backup {
  const result = backupSchema.safeParse(json)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`Not a valid backup file (${issue.path.join('.') || 'root'}: ${issue.message})`)
  }
  const backup = result.data as Backup
  for (const p of backup.meta.periods) {
    if (!backup.periods[p.id]) throw new Error(`Backup is missing data for period "${p.name}"`)
  }
  return backup
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
