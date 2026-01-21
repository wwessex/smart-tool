import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_PROMPT_PACK,
  type PromptPack,
  fetchRemotePromptPack,
  getCachedPromptPack,
  setCachedPromptPack,
  clearCachedPromptPack,
} from "@/lib/prompt-pack";
import { usePromptPack } from "@/hooks/usePromptPack";
import { Download, Upload, Save, RefreshCw, Trash2, Copy, ExternalLink } from "lucide-react";

// Hidden Admin page: lets YOU curate the "AI Playbook" (prompt pack)
// and export it to upload to your backend. No per-user auto-learning.

function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function safeParse(text: string): { ok: true; value: PromptPack } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text);
    // Light validation (full validation is enforced by setCachedPromptPack)
    if (!parsed || typeof parsed !== "object") throw new Error("JSON must be an object");
    if (typeof (parsed as any).version !== "number") throw new Error("Missing/invalid: version (number)");
    if (typeof (parsed as any).updatedAt !== "string") throw new Error("Missing/invalid: updatedAt (string)");
    if (typeof (parsed as any).systemPrompt !== "string") throw new Error("Missing/invalid: systemPrompt (string)");
    if (!Array.isArray((parsed as any).bannedTopics)) throw new Error("Missing/invalid: bannedTopics (array)");
    if (typeof (parsed as any).barrierGuidance !== "object") throw new Error("Missing/invalid: barrierGuidance (object)");
    if (!Array.isArray((parsed as any).fewShot)) throw new Error("Missing/invalid: fewShot (array)");
    return { ok: true, value: parsed as PromptPack };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function AdminPromptPack() {
  const { toast } = useToast();
  const { pack, source } = usePromptPack();
  const [editorText, setEditorText] = useState<string>(prettyJson(DEFAULT_PROMPT_PACK));
  const [status, setStatus] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Prefill editor from current live pack (if available)
  useEffect(() => {
    if (pack) {
      setEditorText(prettyJson(pack));
    }
  }, [pack]);

  const parsed = useMemo(() => safeParse(editorText), [editorText]);

  const currentMeta = useMemo(() => {
    const p = pack || DEFAULT_PROMPT_PACK;
    return { version: p.version, updatedAt: p.updatedAt };
  }, [pack]);

  const handleLoadRemote = async () => {
    setError(null);
    setStatus("Fetching remote prompt-pack.json...");
    try {
      const remote = await fetchRemotePromptPack();
      setEditorText(prettyJson(remote));
      setStatus(`Loaded remote (v${remote.version})`);
      toast({ title: "Loaded remote playbook", description: `Version ${remote.version}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("Remote fetch failed");
      toast({ title: "Remote load failed", description: msg, variant: "destructive" });
    }
  };

  const handleLoadCache = async () => {
    setError(null);
    setStatus("Loading cached playbook from this device...");
    try {
      const cached = await getCachedPromptPack();
      if (!cached) {
        setStatus("No cached playbook found");
        toast({ title: "No cached playbook", description: "Nothing stored in IndexedDB yet." });
        return;
      }
      setEditorText(prettyJson(cached));
      setStatus(`Loaded cache (v${cached.version})`);
      toast({ title: "Loaded cached playbook", description: `Version ${cached.version}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("Cache load failed");
      toast({ title: "Cache load failed", description: msg, variant: "destructive" });
    }
  };

  const handleResetDefaults = () => {
    setError(null);
    setEditorText(prettyJson(DEFAULT_PROMPT_PACK));
    setStatus("Reset to defaults");
    toast({ title: "Reset", description: "Editor reset to the built-in defaults." });
  };

  const handleSaveToDevice = async () => {
    setError(null);
    if (!parsed.ok) {
      setError(parsed.error);
      toast({ title: "Invalid JSON", description: parsed.error, variant: "destructive" });
      return;
    }
    setStatus("Saving to IndexedDB...");
    try {
      await setCachedPromptPack(parsed.value);
      setStatus(`Saved to device (v${parsed.value.version})`);
      toast({ title: "Saved to device", description: `Playbook v${parsed.value.version} cached.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("Save failed");
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleClearDeviceCache = async () => {
    setError(null);
    setStatus("Clearing cached playbook...");
    try {
      await clearCachedPromptPack();
      setStatus("Cleared cached playbook");
      toast({ title: "Cleared", description: "IndexedDB cache removed." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("Clear failed");
      toast({ title: "Clear failed", description: msg, variant: "destructive" });
    }
  };

  const handleDownload = () => {
    setError(null);
    if (!parsed.ok) {
      setError(parsed.error);
      toast({ title: "Invalid JSON", description: parsed.error, variant: "destructive" });
      return;
    }
    const blob = new Blob([prettyJson(parsed.value)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompt-pack.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "prompt-pack.json saved." });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editorText);
      toast({ title: "Copied", description: "JSON copied to clipboard." });
    } catch (e) {
      toast({ title: "Copy failed", description: "Clipboard not available in this browser.", variant: "destructive" });
    }
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    setStatus("Importing JSON file...");
    try {
      const text = await file.text();
      const p = safeParse(text);
      if (!p.ok) throw new Error(p.error);
      setEditorText(prettyJson(p.value));
      setStatus(`Imported ${file.name} (v${p.value.version})`);
      toast({ title: "Imported", description: file.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("Import failed");
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Admin: AI Playbook (Prompt Pack)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Edit the centrally-taught rules/examples that shape Local AI Draft outputs.
                  This does <span className="font-medium">not</span> learn per end-user.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary">Source: {source || "loading"}</Badge>
                <div className="text-xs text-muted-foreground">
                  Live: v{currentMeta.version} • {currentMeta.updatedAt}
                </div>
              </div>
            </div>

            <Alert>
              <AlertTitle>How to publish to your backend</AlertTitle>
              <AlertDescription className="space-y-2">
                <div>
                  1) Click <span className="font-medium">Download JSON</span> → it saves as <code>prompt-pack.json</code>.
                </div>
                <div>
                  2) Upload/replace <code>/prompt-pack.json</code> on your site (same folder level as your app).
                </div>
                <div>
                  3) Bump <span className="font-medium">version</span> when you deploy so clients refresh.
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1 text-sm text-primary underline"
                    href={"#/"}
                    title="Back to app"
                  >
                    Back to app <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleLoadRemote}>
                <RefreshCw className="h-4 w-4 mr-2" /> Load remote
              </Button>
              <Button variant="secondary" onClick={handleLoadCache}>
                <RefreshCw className="h-4 w-4 mr-2" /> Load device cache
              </Button>
              <Button variant="secondary" onClick={handleResetDefaults}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reset defaults
              </Button>
              <Separator className="mx-2 h-10" orientation="vertical" />
              <Button onClick={handleSaveToDevice}>
                <Save className="h-4 w-4 mr-2" /> Save to device
              </Button>
              <Button variant="destructive" onClick={handleClearDeviceCache}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear device cache
              </Button>
              <Separator className="mx-2 h-10" orientation="vertical" />
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> Download JSON
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" /> Copy JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" /> Import JSON
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                  // reset input so selecting same file again triggers change
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Status: <span className="font-medium">{status}</span>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Problem</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!parsed.ok && (
              <Alert variant="destructive">
                <AlertTitle>JSON validation</AlertTitle>
                <AlertDescription>{parsed.error}</AlertDescription>
              </Alert>
            )}

            <Textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              className="min-h-[420px] font-mono text-xs"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
