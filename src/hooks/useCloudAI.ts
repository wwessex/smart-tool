import { useState, useCallback, useRef } from "react";
import { useAIConsent } from "@/hooks/useAIConsent";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseCloudAIState {
  isGenerating: boolean;
  error: string | null;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-chat`;

export function useCloudAI() {
  const [state, setState] = useState<UseCloudAIState>({
    isGenerating: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const hasConsent = useAIConsent();

  // Check if user has given AI consent
  const checkConsent = useCallback((): boolean => {
    return hasConsent;
  }, [hasConsent]);

  const chat = useCallback(
    async function* (
      messages: ChatMessage[],
      systemPrompt?: string
    ): AsyncGenerator<string, void, unknown> {
      // GDPR: Check consent before making cloud AI request
      if (!hasConsent) {
        setState({ isGenerating: false, error: "AI consent required" });
        throw new Error("Cloud AI requires user consent. Please enable AI features in settings.");
      }

      setState({ isGenerating: true, error: null });
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            systemPrompt,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `Error: ${response.status}`;
          setState({ isGenerating: false, error: errorMessage });
          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          // Process line-by-line
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                yield content;
              }
            } catch {
              // Incomplete JSON, put it back
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) yield content;
            } catch {
              /* ignore */
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Cloud AI chat error:", err);
          setState((prev) => ({
            ...prev,
            error: err.message,
          }));
        }
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
        abortControllerRef.current = null;
      }
    },
    [hasConsent]
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({ ...prev, isGenerating: false }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    chat,
    abort,
    clearError,
    checkConsent,
    hasConsent,
  };
}
