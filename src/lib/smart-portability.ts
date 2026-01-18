import { z } from 'zod';

// NOTE:
// - We support multiple historical export shapes for backward compatibility.
// - Current canonical shape is "top-level payload" (no `data` wrapper).

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
  translatedText: z.string().max(8000).optional(),
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
  retentionEnabled: z.boolean().optional(),
  retentionDays: z.number().int().min(7).max(365).optional(),
  participantLanguage: z.string().max(20).optional(),
  clearConfirmEnabled: z.boolean().optional(),
});

export const SmartToolImportPayloadSchema = z.object({
  history: z.array(HistoryItemSchema).max(100).optional(),
  barriers: z.array(z.string().max(200)).max(50).optional(),
  timescales: z.array(z.string().max(50)).max(20).optional(),
  recentNames: z.array(z.string().max(100)).max(10).optional(),
  templates: z.array(ActionTemplateSchema).max(50).optional(),
  settings: SettingsSchema.optional(),
});

// Outer file schema: allows either payload at top level, OR payload nested under `data`.
// Also allows extra metadata keys without failing validation.
const SmartToolImportFileSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  data: z.unknown().optional(),
}).passthrough();

export type SmartToolImportPayload = z.infer<typeof SmartToolImportPayloadSchema>;

export function parseSmartToolImportFile(raw: unknown): SmartToolImportPayload {
  const outer = SmartToolImportFileSchema.parse(raw);
  const candidate =
    outer.data && typeof outer.data === 'object' && !Array.isArray(outer.data)
      ? outer.data
      : outer;
  return SmartToolImportPayloadSchema.parse(candidate);
}

