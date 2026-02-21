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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTeacherExample(example: string, opts: { replaceName?: string; replaceDate?: string; replaceTime?: string }): string {
  let t = (example || "").trim();

  // Replace an explicit name/date entered by the admin with placeholders.
  if (opts.replaceName && opts.replaceName.trim()) {
    const re = new RegExp(escapeRegExp(opts.replaceName.trim()), "g");
    t = t.replace(re, "[NAME]");
  }
  if (opts.replaceDate && opts.replaceDate.trim()) {
    const re = new RegExp(escapeRegExp(opts.replaceDate.trim()), "g");
    t = t.replace(re, "[DATE]");
  }

  if (opts.replaceTime && opts.replaceTime.trim()) {
    const re = new RegExp(escapeRegExp(opts.replaceTime.trim()), "g");
    t = t.replace(re, "[TIME]");
  }

  // Normalise common placeholder token variants to our standard.
  t = t.replace(/\{\s*name\s*\}/gi, "[NAME]");
  t = t.replace(/\{\s*date\s*\}/gi, "[DATE]");
  t = t.replace(/\[\s*date\s*\]/gi, "[DATE]");
  t = t.replace(/\[\s*name\s*\]/gi, "[NAME]");
  t = t.replace(/\{\s*time\s*\}/gi, "[TIME]");
  t = t.replace(/\[\s*time\s*\]/gi, "[TIME]");
  // Fix common bracket typos like [NAME} or [Time}
  t = t.replace(/\[\s*name\s*\}/gi, "[NAME]");
  t = t.replace(/\[\s*date\s*\}/gi, "[DATE]");
  t = t.replace(/\[\s*time\s*\}/gi, "[TIME]");

  return t;
}


type ParseResult = { ok: true; value: PromptPack; error?: undefined } | { ok: false; error: string; value?: undefined };

function safeParse(text: string): ParseResult {
  try {
    const parsed: unknown = JSON.parse(text);
    // Light validation (full validation is enforced by setCachedPromptPack)
    if (!parsed || typeof parsed !== "object") throw new Error("JSON must be an object");
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.version !== "number") throw new Error("Missing/invalid: version (number)");
    if (typeof obj.updatedAt !== "string") throw new Error("Missing/invalid: updatedAt (string)");
    if (typeof obj.systemPrompt !== "string") throw new Error("Missing/invalid: systemPrompt (string)");
    if (!Array.isArray(obj.bannedTopics)) throw new Error("Missing/invalid: bannedTopics (array)");
    if (typeof obj.barrierGuidance !== "object") throw new Error("Missing/invalid: barrierGuidance (object)");
    if (!Array.isArray(obj.fewShot)) throw new Error("Missing/invalid: fewShot (array)");
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

  // SMART Teacher (guided wizard)
  const [teacherBarrier, setTeacherBarrier] = useState<string>("");
  const [teacherExample, setTeacherExample] = useState<string>("");
  const [teacherHelp, setTeacherHelp] = useState<string>("");
  const [teacherReplaceName, setTeacherReplaceName] = useState<string>("");
  const [teacherReplaceDate, setTeacherReplaceDate] = useState<string>("");
  const [teacherReplaceTime, setTeacherReplaceTime] = useState<string>("");

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

  const handleTeachAddExample = () => {
    setError(null);

    if (!parsed.ok) {
      setError(parsed.error);
      toast({ title: "Invalid JSON", description: parsed.error, variant: "destructive" });
      return;
    }

    const barrier = (teacherBarrier || "").trim();
    let example = (teacherExample || "").trim();
    const help = (teacherHelp || "").trim();

    if (!barrier) {
      toast({ title: "Missing barrier/task", description: "Enter a barrier or task to teach.", variant: "destructive" });
      return;
    }
    if (!example) {
      toast({ title: "Missing example", description: "Paste a SMART action example.", variant: "destructive" });
      return;
    }

    // 1) Apply explicit replacements (if the admin typed a real name/date below)
    example = normalizeTeacherExample(example, {
      replaceName: teacherReplaceName,
      replaceDate: teacherReplaceDate,
      replaceTime: teacherReplaceTime,
    });

    // 2) If the admin didn't use placeholders but wrote 'Alex will ...', convert the leading name.
    if (!/\[NAME\]/i.test(example)) {
      const m = example.match(/^([A-Z][a-z]+)\s+will\\b/);
      if (m && m[1]) {
        example = example.replace(/^([A-Z][a-z]+)\s+will\\b/, "[NAME] will");
      }
    }

    // 3) If the admin didn't use a date placeholder, convert the first obvious date after 'by'.
    if (!/\[DATE\]/i.test(example)) {
      const byDate = example.match(/\\bby\s+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}|[0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})\\b/);
      if (byDate && byDate[1]) {
        example = example.replace(byDate[1], "[DATE]");
      }
    }

    // 4) If the admin didn't use a time placeholder, convert the first obvious time after 'at'.
    if (!/\[TIME\]/i.test(example)) {
      const atTime = example.match(/\bat\s+([0-9]{1,2}(?::[0-9]{2})?\s?(?:am|pm)\b|[0-9]{1,2}\s?(?:am|pm)\b|[0-9]{1,2}:[0-9]{2}\b)\b/i);
      if (atTime && atTime[1]) {
        example = example.replace(atTime[1], "[TIME]");
      }
    }

    const next = JSON.parse(JSON.stringify(parsed.value)) as PromptPack;
    // Allow MULTIPLE examples per barrier (append + de-dupe) instead of overwriting.
    // We keep newest first so Draft tends to use the freshest taught example.
    const entry = {
      barrier,
      action: example,
      help: help || "support progress towards employment",
    };

    const sameBarrier = (x: { barrier: string }) => x.barrier.toLowerCase() === barrier.toLowerCase();
    const normalizeAction = (s: string) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

    const exists = next.fewShot.some((x) => sameBarrier(x) && normalizeAction(x.action) === normalizeAction(entry.action));
    if (!exists) {
      next.fewShot.unshift(entry);
    }

    const count = next.fewShot.filter(sameBarrier).length;

    // Bump meta so clients know it changed.
    next.version = Math.max(1, (next.version || 1) + 1);
    next.updatedAt = new Date().toISOString().slice(0, 10);

    setEditorText(prettyJson(next));
    setStatus(`SMART Teacher: ${exists ? "example already existed" : "added example"} for '${barrier}' (${count} total) (v${next.version})`);
    toast({
      title: exists ? "Already saved" : "Taught playbook",
      description: exists ? `That example already exists for '${barrier}'.` : `Saved example for '${barrier}' (${count} total).`,
    });
  };

  const handleTeachReset = () => {
    setTeacherBarrier("");
    setTeacherExample("");
    setTeacherHelp("");
    setTeacherReplaceName("");
    setTeacherReplaceDate("");
    setTeacherReplaceTime("");
    toast({ title: "Reset", description: "SMART Teacher cleared." });
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

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">SMART Teacher (guided)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Teach the playbook by example. Use <code>[NAME]</code>, <code>[DATE]</code>, and <code>[TIME]</code> placeholders in examples.
                  The app will substitute the participant name/date/time at runtime.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Barrier / task</label>
                    <Input
                      value={teacherBarrier}
                      onChange={(e) => setTeacherBarrier(e.target.value)}
                      placeholder="e.g. Confidence, Transport, Digital skills, Interview preparation"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Benefit (optional)</label>
                    <Input
                      value={teacherHelp}
                      onChange={(e) => setTeacherHelp(e.target.value)}
                      placeholder="e.g. feel more confident in interviews"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">SMART action example</label>
                  <Textarea
                    value={teacherExample}
                    onChange={(e) => setTeacherExample(e.target.value)}
                    placeholder="Example: [NAME] will apply for 3 suitable roles on Indeed and CV Library by [DATE]."
                    className="min-h-[120px]"
                  />
                  <div className="text-xs text-muted-foreground">
                    Tip: If your example contains a real name/date, enter it below so we can convert it to placeholders.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Name in example to replace (optional)</label>
                    <Input
                      value={teacherReplaceName}
                      onChange={(e) => setTeacherReplaceName(e.target.value)}
                      placeholder="e.g. Alex"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Date in example to replace (optional)</label>
                    <Input
                      value={teacherReplaceDate}
                      onChange={(e) => setTeacherReplaceDate(e.target.value)}
                      placeholder="e.g. 25-Jan-26"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Time in example to replace (optional)</label>
                    <Input
                      value={teacherReplaceTime}
                      onChange={(e) => setTeacherReplaceTime(e.target.value)}
                      placeholder="e.g. 11am"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleTeachAddExample}>
                    Add example to playbook
                  </Button>
                  <Button variant="secondary" onClick={handleTeachReset}>
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

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
