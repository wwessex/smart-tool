import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '@/hooks/useTranslation';

// Mock the Lengua Materna engine module
const mockTranslate = vi.fn();
const mockInitialize = vi.fn();

vi.mock('@smart-tool/lengua-materna', () => ({
  TranslationEngine: vi.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    translate: mockTranslate,
  })),
  SUPPORTED_LANGUAGES: {
    en: { code: 'en', name: 'English', nativeName: 'English', flag: 'GB', direction: 'ltr' },
    ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: 'SA', direction: 'rtl', scriptHint: 'Use Arabic script.' },
    pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: 'PL', direction: 'ltr' },
    cy: { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', flag: 'CY', direction: 'ltr' },
    ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: 'PK', direction: 'rtl' },
    ps: { code: 'ps', name: 'Pashto', nativeName: 'پښتو', flag: 'AF', direction: 'rtl' },
  },
  isRTL: vi.fn((lang: string) => ['ar', 'ps', 'ur'].includes(lang)),
}));

describe('useTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialize.mockResolvedValue(undefined);
  });

  it('returns translated result and updates state on success', async () => {
    mockTranslate.mockResolvedValue({
      original: 'Hello',
      translated: 'مرحباً',
      sourceLang: 'en',
      targetLang: 'ar',
      usedPivot: false,
      durationMs: 100,
      chunksTranslated: 1,
      modelsUsed: ['opus-mt-en-ar'],
    });

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(mockTranslate).toHaveBeenCalledWith({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'ar',
    });
    expect(translated).toEqual({
      original: 'Hello',
      translated: 'مرحباً',
      language: 'ar',
      languageName: 'Arabic',
    });
    expect(result.current.result).toEqual(translated);
    expect(result.current.error).toBeNull();
    expect(result.current.isTranslating).toBe(false);
  });


  it('falls back to legacy translation_text responses', async () => {
    mockTranslate.mockResolvedValue({
      original: 'Hello',
      translation_text: 'مرحبا',
      sourceLang: 'en',
      targetLang: 'ar',
      usedPivot: false,
      durationMs: 120,
      chunksTranslated: 1,
      modelsUsed: ['opus-mt-en-ar'],
    });

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translated).toEqual({
      original: 'Hello',
      translated: 'مرحبا',
      language: 'ar',
      languageName: 'Arabic',
    });
  });


  it('supports plain string responses from translation wrappers', async () => {
    mockTranslate.mockResolvedValue('  مرحبا بكم  ');

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translated).toEqual({
      original: 'Hello',
      translated: 'مرحبا بكم',
      language: 'ar',
      languageName: 'Arabic',
    });
  });

  it('supports nested result payload responses', async () => {
    mockTranslate.mockResolvedValue({
      result: {
        translated: 'أهلاً',
      },
    });

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translated).toEqual({
      original: 'Hello',
      translated: 'أهلاً',
      language: 'ar',
      languageName: 'Arabic',
    });
  });


  it('returns error when engine returns an empty translation payload', async () => {
    mockTranslate.mockResolvedValue({
      original: 'Hello',
      translated: '   ',
      sourceLang: 'en',
      targetLang: 'ar',
      usedPivot: false,
      durationMs: 75,
      chunksTranslated: 1,
      modelsUsed: ['opus-mt-en-ar'],
    });

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translated).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('Translation model returned empty output. The model may still be loading — please try again.');
  });

  it('returns null and sets error on translation failure', async () => {
    mockTranslate.mockRejectedValue(new Error('model load failed'));

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translated).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('model load failed');
    expect(result.current.isTranslating).toBe(false);
  });

  it('returns null when translation is disabled', async () => {
    const { result } = renderHook(() => useTranslation({ enabled: false }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translated).toBeNull();
    expect(result.current.error).toBe('Translation is disabled.');
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('returns null for empty text or "none" language', async () => {
    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('', 'ar');
    });
    expect(translated).toBeNull();

    await act(async () => {
      translated = await result.current.translate('Hello', 'none');
    });
    expect(translated).toBeNull();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('reports RTL correctly for Arabic-script languages', () => {
    const { result } = renderHook(() => useTranslation({ enabled: true }));

    expect(result.current.isRTL('ar')).toBe(true);
    expect(result.current.isRTL('ur')).toBe(true);
    expect(result.current.isRTL('ps')).toBe(true);
    expect(result.current.isRTL('pl')).toBe(false);
    expect(result.current.isRTL('cy')).toBe(false);
  });
});
