import { z } from 'zod';

// Schemas for validating import payloads.
// Supports both:
// - "flat" exports: { history, barriers, timescales, ... }
// - "wrapped" exports: { version, exportedAt, data: { history, barriers, ... } }

const HistoryItemMetaSchema = z.object({
  date: z.string().max(50),
  forename: z.string().max(100),
  barrier: z.string().max(200),
  timescale: z.string().max(50),
  action: z.string().max(2000).optional(),
  responsible: z.string().max(100).optional(),
  help: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
  // Translation fields (stored locally only)
  translatedText: z.string().max(10000).optional(),
  translationLanguage: z.string().max(20).optional(),
});

const HistoryItemSchema = z.object({
  id: z.string().max(100),
  mode: z.enum(['now', 'future']),
  createdAt: z.string().max(50),
  text: z.string().max(5000),
  meta: HistoryItemMetaSchema,
});

const ActionTemplateSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  mode: z.enum(['now', 'future']),
  createdAt: z.string().max(50),
  barrier: z.string().max(200).optional(),
  action: z.string().max(5000).optional(),
  responsible: z.string().max(100).optional(),
  help: z.string().max(5000).optional(),
  task: z.string().max(2000).optional(),
  outcome: z.string().max(5000).optional(),
});

const SettingsSchema = z.object({
  minScoreEnabled: z.boolean().optional(),
  minScoreThreshold: z.number().int().min(1).max(5).optional(),
});

const DataSchema = z.object({
  history: z.array(HistoryItemSchema).max(100).optional(),
  barriers: z.array(z.string().max(200)).max(50).optional(),
  timescales: z.array(z.string().max(50)).max(20).optional(),
  recentNames: z.array(z.string().max(100)).max(20).optional(),
  templates: z.array(ActionTemplateSchema).max(50).optional(),
  settings: SettingsSchema.optional(),
});

const FlatImportSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  ...DataSchema.shape,
});

const WrappedImportSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  data: DataSchema,
});

export const SmartImportSchema = z.union([FlatImportSchema, WrappedImportSchema]).transform((value) => {
  if ('data' in value) {
    return {
      version: value.version,
      exportedAt: value.exportedAt,
      ...value.data,
    };
  }
  return value;
});

export type SmartImportData = z.infer<typeof SmartImportSchema>;

export function parseSmartImport(input: unknown): SmartImportData {
  return SmartImportSchema.parse(input);
}
