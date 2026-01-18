import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Square,
  Trash2,
  Sparkles,
  User,
  AlertCircle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCloudAI } from "@/hooks/useCloudAI";
import { useAIConsent } from "@/hooks/useAIConsent";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface LLMChatProps {
  trigger?: React.ReactNode;
  systemPrompt?: string;
  initialContext?: string;
  onResponse?: (response: string) => void;
}

export function LLMChat({
  trigger,
  systemPrompt = "You are a helpful AI assistant. Be concise and helpful.",
  initialContext,
  onResponse,
}: LLMChatProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Chat
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[85vh] max-h-[85vh] sm:h-[80vh] sm:max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant
          </DialogTitle>
        </DialogHeader>
        <AIChatContent
          systemPrompt={systemPrompt}
          initialContext={initialContext}
          onResponse={onResponse}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AIChatContentProps {
  systemPrompt: string;
  initialContext?: string;
  onResponse?: (response: string) => void;
}

function AIChatContent({
  systemPrompt,
  initialContext,
  onResponse,
}: AIChatContentProps) {
  const cloudAI = useCloudAI();
  const cloudHasConsent = useAIConsent();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialContext || "");
  const [streamingContent, setStreamingContent] = useState("");
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = cloudAI.isGenerating;
  const isReady = cloudHasConsent;
  const error = cloudAI.error;
  const lastMessage = messages[messages.length - 1];
  const canRetry = !isGenerating && lastMessage?.role === "user";

  const clearActiveError = useCallback(() => {
    cloudAI.clearError();
  }, [cloudAI]);

  const retryLastMessage = useCallback(async () => {
    const currentLast = messages[messages.length - 1];
    if (isGenerating || !currentLast || currentLast.role !== "user") return;

    clearActiveError();
    setStreamingContent("");
    let fullResponse = "";

    try {
      for await (const chunk of cloudAI.chat(messages, systemPrompt)) {
        fullResponse += chunk;
        setStreamingContent(fullResponse);
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: fullResponse,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
      onResponse?.(fullResponse);
    } catch (err) {
      console.error("Chat retry error:", err);
    }
  }, [isGenerating, messages, cloudAI, systemPrompt, onResponse, clearActiveError]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus textarea when ready
  useEffect(() => {
    if (isReady && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isReady]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;
    if (!cloudHasConsent) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreamingContent("");

    let fullResponse = "";

    try {
      for await (const chunk of cloudAI.chat(newMessages, systemPrompt)) {
        fullResponse += chunk;
        setStreamingContent(fullResponse);
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: fullResponse,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
      onResponse?.(fullResponse);
    } catch (err) {
      console.error("Chat error:", err);
    }
  }, [input, isGenerating, cloudAI, messages, systemPrompt, onResponse, cloudHasConsent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingContent("");
  };

  const handleAbort = () => {
    cloudAI.abort();
  };

  // Chat view
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Status bar */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Cloud AI (Gemini)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="h-7 text-xs"
          disabled={messages.length === 0}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Cloud AI Consent Warning */}
      {!cloudHasConsent && (
        <div className="px-4 py-2">
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm">AI Consent Required</AlertTitle>
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-400 space-y-2">
              <p>Cloud AI requires consent to process your messages. Enable AI features in your privacy settings.</p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start a conversation with AI</p>
              <p className="text-xs mt-1">
                {cloudHasConsent ? "Powered by Gemini" : "Enable AI consent to start"}
              </p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming response */}
          {streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted">
                <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2">
          {(error.toLowerCase().includes("fetch") || error.toLowerCase().includes("network")) ? (
            <Alert className="py-2 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm">Connection Blocked</AlertTitle>
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-400 space-y-2">
                <p>Unable to reach Cloud AI. This is often caused by corporate network restrictions or firewalls.</p>
                <p className="font-medium">Try these alternatives:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Use your phone's mobile hotspot</li>
                  <li>Connect to a personal/home network</li>
                  <li>Ask IT to whitelist *.supabase.co</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  {canRetry && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={retryLastMessage}
                      className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                    >
                      Retry
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearActiveError}
                    className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-2">
                <p>{error}</p>
                <div className="flex flex-wrap gap-2">
                  {canRetry && (
                    <Button variant="outline" size="sm" onClick={retryLastMessage} className="h-7 text-xs bg-background text-foreground">
                      Retry
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={clearActiveError} className="h-7 text-xs bg-background text-foreground">
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-32 resize-none"
            disabled={isGenerating}
            rows={1}
          />
          {isGenerating ? (
            <Button onClick={handleAbort} variant="destructive" size="icon" className="shrink-0">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim() || !cloudHasConsent}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Button component that shows AI chat - works on all devices
export function LLMChatButton({
  className,
  trigger,
  ...props
}: LLMChatProps & { className?: string }) {
  return (
    <LLMChat
      trigger={
        trigger || (
          <Button variant="outline" size="sm" className={cn("gap-2", className)}>
            <Bot className="h-4 w-4" />
            AI Chat
          </Button>
        )
      }
      {...props}
    />
  );
}
