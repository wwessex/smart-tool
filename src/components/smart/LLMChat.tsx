import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Square,
  Cpu,
  Cloud,
  Download,
  Trash2,
  Sparkles,
  User,
  AlertCircle,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebGPUSupport } from "./WebGPUCheck";
import { useLLM, ChatMessage, RECOMMENDED_MODELS } from "@/hooks/useLLM";
import { useCloudAI } from "@/hooks/useCloudAI";
import { cn } from "@/lib/utils";

interface LLMChatProps {
  trigger?: React.ReactNode;
  systemPrompt?: string;
  initialContext?: string;
  onResponse?: (response: string) => void;
}

type AIMode = "cloud" | "local";

export function LLMChat({
  trigger,
  systemPrompt = "You are a helpful AI assistant. Be concise and helpful.",
  initialContext,
  onResponse,
}: LLMChatProps) {
  const [open, setOpen] = useState(false);
  const { supported: webGPUSupported } = useWebGPUSupport();

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
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
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
          webGPUSupported={webGPUSupported}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AIChatContentProps {
  systemPrompt: string;
  initialContext?: string;
  onResponse?: (response: string) => void;
  webGPUSupported: boolean;
}

function AIChatContent({
  systemPrompt,
  initialContext,
  onResponse,
  webGPUSupported,
}: AIChatContentProps) {
  // Default to cloud if WebGPU not supported
  const [mode, setMode] = useState<AIMode>(webGPUSupported ? "cloud" : "cloud");
  
  const localAI = useLLM();
  const cloudAI = useCloudAI();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialContext || "");
  const [streamingContent, setStreamingContent] = useState("");
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = mode === "local" ? localAI.isGenerating : cloudAI.isGenerating;
  const isReady = mode === "local" ? localAI.isReady : true; // Cloud is always ready
  const error = mode === "local" ? localAI.error : cloudAI.error;
  const isLoading = mode === "local" ? localAI.isLoading : false;
  const loadingProgress = localAI.loadingProgress;
  const loadingStatus = localAI.loadingStatus;

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
    if (mode === "local" && !localAI.isReady) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreamingContent("");

    let fullResponse = "";

    try {
      const chatFn = mode === "local" ? localAI.chat : cloudAI.chat;
      
      for await (const chunk of chatFn(newMessages, systemPrompt)) {
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
  }, [input, isGenerating, mode, localAI, cloudAI, messages, systemPrompt, onResponse]);

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
    if (mode === "local") {
      localAI.abort();
    } else {
      cloudAI.abort();
    }
  };

  // Show model selection for local mode
  if (mode === "local" && !localAI.isReady && !localAI.isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <ModeTabs mode={mode} setMode={setMode} webGPUSupported={webGPUSupported} />
        <div className="flex-1 p-6 space-y-4">
          <div className="text-center space-y-2">
            <HardDrive className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Select an AI Model</h3>
            <p className="text-sm text-muted-foreground">
              Models run entirely in your browser. Downloaded once, cached locally.
            </p>
          </div>

          {localAI.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{localAI.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            {localAI.supportedModels.map((model) => (
              <button
                key={model.id}
                onClick={() => localAI.loadModel(model.id)}
                className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
              >
                <Download className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{model.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {model.description}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {model.size}
                </Badge>
              </button>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            First download may take a few minutes depending on your connection.
          </p>
        </div>
      </div>
    );
  }

  // Loading view for local mode
  if (mode === "local" && isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <ModeTabs mode={mode} setMode={setMode} webGPUSupported={webGPUSupported} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="relative">
            <Cpu className="h-16 w-16 text-primary animate-pulse" />
            <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1 animate-bounce" />
          </div>
          
          <div className="w-full max-w-sm space-y-2">
            <Progress value={loadingProgress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {loadingStatus || "Starting worker..."}
            </p>
          </div>

          <p className="text-xs text-center text-muted-foreground max-w-xs">
            {loadingProgress === 0 
              ? "Initializing the AI engine. This may take 10-30 seconds on first load..."
              : loadingProgress < 100
                ? "Downloading and caching model... This only happens once."
                : "Finalizing setup..."}
          </p>
          
          {loadingProgress === 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setMode("cloud")}
              className="mt-2"
            >
              <Cloud className="h-4 w-4 mr-2" />
              Switch to Cloud AI
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ModeTabs mode={mode} setMode={setMode} webGPUSupported={webGPUSupported} />
      
      {/* Status bar */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">
            {mode === "cloud" ? (
              "Cloud AI (Gemini)"
            ) : (
              RECOMMENDED_MODELS.find((m) => m.id === localAI.selectedModel)?.name || "Local Model"
            )}
          </span>
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start a conversation with AI</p>
              <p className="text-xs mt-1">
                {mode === "cloud" ? "Powered by Gemini" : "Running locally in your browser"}
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
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
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
              disabled={!input.trim()}
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

interface ModeTabsProps {
  mode: AIMode;
  setMode: (mode: AIMode) => void;
  webGPUSupported: boolean;
}

function ModeTabs({ mode, setMode, webGPUSupported }: ModeTabsProps) {
  return (
    <div className="px-4 pt-2 pb-0">
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setMode("cloud")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            mode === "cloud"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Cloud className="h-4 w-4" />
          Cloud AI
        </button>
        <button
          onClick={() => webGPUSupported && setMode("local")}
          disabled={!webGPUSupported}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            mode === "local"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            !webGPUSupported && "opacity-50 cursor-not-allowed"
          )}
          title={!webGPUSupported ? "WebGPU not supported in this browser" : undefined}
        >
          <Cpu className="h-4 w-4" />
          Local AI
          {!webGPUSupported && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              N/A
            </Badge>
          )}
        </button>
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
