import { describe, it, expect } from 'vitest';

import { parseSmartImport } from '../lib/smart-import';

describe('parseSmartImport', () => {
  it('parses flat import payload (history/barriers/timescales)', () => {
    const flat = {
      version: 1,
      exportedAt: new Date().toISOString(),
      barriers: ['Housing'],
      timescales: ['2 weeks'],
      history: [
        {
          id: 'h1',
          mode: 'now',
          createdAt: new Date().toISOString(),
          text: 'Example action',
          meta: {
            date: '2026-01-01',
            forename: 'Sam',
            barrier: 'Housing',
            timescale: '2 weeks',
          },
        },
      ],
    };

    const parsed = parseSmartImport(flat);
    expect(parsed.barriers).toEqual(['Housing']);
    expect(parsed.timescales).toEqual(['2 weeks']);
    expect(parsed.history?.[0]?.id).toBe('h1');
  });

  it('parses wrapped export payload (version/exportedAt + data wrapper)', () => {
    const wrapped = {
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        barriers: ['Finance'],
        timescales: ['1 month'],
        recentNames: ['Alex'],
        templates: [
          {
            id: 't1',
            name: 'Template 1',
            mode: 'now',
            createdAt: '2026-01-01T00:00:00.000Z',
            barrier: 'Finance',
            action: 'Do the thing',
          },
        ],
        settings: {
          minScoreEnabled: true,
          minScoreThreshold: 4,
        },
        history: [
          {
            id: 'h2',
            mode: 'future',
            createdAt: '2026-01-01T00:00:00.000Z',
            text: 'Future action',
            meta: {
              date: '2026-01-01',
              forename: 'Alex',
              barrier: 'Attend job fair',
              timescale: '1 month',
              translatedText: 'Traduction',
              translationLanguage: 'fr',
            },
          },
        ],
      },
    };

    const parsed = parseSmartImport(wrapped);
    expect(parsed.barriers).toEqual(['Finance']);
    expect(parsed.recentNames).toEqual(['Alex']);
    expect(parsed.templates?.[0]?.id).toBe('t1');
    expect(parsed.settings).toEqual({ minScoreEnabled: true, minScoreThreshold: 4 });
    expect(parsed.history?.[0]?.meta?.translatedText).toBe('Traduction');
  });
});

