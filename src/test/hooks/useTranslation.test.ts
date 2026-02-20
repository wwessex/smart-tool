import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '@/hooks/useTranslation';
import { translateOffline } from '@/lib/localTranslator';

vi.mock('@/lib/localTranslator', () => ({
  translateOffline: vi.fn(),
  isRTL: vi.fn((lang: string) => ['ar', 'ps', 'ur'].includes(lang)),
}));

describe('useTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns translated result and updates state on success', async () => {
    vi.mocked(translateOffline).mockResolvedValue('مرحباً');

    const { result } = renderHook(() => useTranslation({ enabled: true }));

    let translated = null;
    await act(async () => {
      translated = await result.current.translate('Hello', 'ar');
    });

    expect(translateOffline).toHaveBeenCalledWith('Hello', 'ar');
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

  it('returns null and sets error on translation failure', async () => {
    vi.mocked(translateOffline).mockRejectedValue(new Error('model load failed'));

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
});
