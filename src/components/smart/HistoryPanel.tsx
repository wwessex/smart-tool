import { useState, useMemo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';
import type { HistoryItem } from '@/hooks/useSmartStorage';
import type { SmartCheck } from '@/lib/smart-checker';
import {
  Copy, Download, Trash2, History, Edit, BarChart3,
} from 'lucide-react';

const HistoryInsights = lazy(() => import('./HistoryInsights').then(module => ({ default: module.HistoryInsights })));

const InsightsSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
    <div className="h-48 rounded-xl skeleton-shimmer" style={{ animationDelay: '0.6s' }} />
  </div>
);

export interface HistoryPanelProps {
  history: HistoryItem[];
  hasOutput: boolean;
  output: string;
  smartCheck: SmartCheck;
  minScoreEnabled: boolean;
  minScoreThreshold: number;
  onSave: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearHistory: () => void;
  onEditHistory: (item: HistoryItem) => void;
  onDeleteFromHistory: (id: string) => void;
}

export function HistoryPanel({
  history,
  hasOutput,
  output,
  smartCheck,
  minScoreEnabled,
  minScoreThreshold,
  onSave,
  onExport,
  onImport,
  onClearHistory,
  onEditHistory,
  onDeleteFromHistory,
}: HistoryPanelProps) {
  const { toast } = useToast();
  const [historySearch, setHistorySearch] = useState('');
  const [historyTab, setHistoryTab] = useState<'history' | 'insights'>('history');

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    if (!q) return history;
    return history.filter(h =>
      h.text.toLowerCase().includes(q) ||
      h.meta.forename?.toLowerCase().includes(q) ||
      h.meta.barrier?.toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-bold text-lg">History</h2>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={onSave}
            disabled={!output.trim() || (minScoreEnabled && smartCheck.overallScore < minScoreThreshold)}
            className="bg-primary hover:bg-primary/90"
            aria-label="Save current action to history"
          >
            Save to History
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>Export</Button>
          <label className="cursor-pointer">
            <Button size="sm" variant="outline" asChild><span>Import</span></Button>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onImport}
              aria-label="Import history from JSON file"
            />
          </label>
          <Button
            size="sm"
            variant="destructive"
            onClick={onClearHistory}
            aria-label="Clear all history"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Clear history</span>
          </Button>
        </div>
      </div>

      <Tabs data-tutorial="history" value={historyTab} onValueChange={(v) => setHistoryTab(v as 'history' | 'insights')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" /> History
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4 space-y-4">
          <Input
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            placeholder="Search history…"
            className="text-sm"
            aria-label="Search history"
            type="search"
          />

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {filteredHistory.length === 0 ? (
              <EmptyState
                variant={historySearch ? 'search' : 'history'}
                className="py-6"
              />
            ) : (
              <ul role="list" aria-label="Saved actions history">
                {filteredHistory.map((h, index) => (
                  <motion.li
                    key={h.id}
                    className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-3 hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm mb-3 last:mb-0 transition-[border-color,background-color,box-shadow] duration-200 ease-spring"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full font-medium",
                        h.mode === 'now' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                      )}>
                        {h.mode === 'now' ? 'Barrier to action' : 'Task-based'}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      {h.meta.forename && (
                        <span className="text-muted-foreground">• {h.meta.forename}</span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{h.text}</p>
                    {h.meta.translatedText && h.meta.translationLanguage && (
                      <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {SUPPORTED_LANGUAGES[h.meta.translationLanguage]?.flag && (
                            <span className="inline-flex items-center justify-center rounded-sm border px-1 text-[10px] font-semibold leading-4 text-foreground/80 mr-1">
                              {SUPPORTED_LANGUAGES[h.meta.translationLanguage].flag}
                            </span>
                          )}
                          {SUPPORTED_LANGUAGES[h.meta.translationLanguage]?.nativeName?.toUpperCase() || h.meta.translationLanguage.toUpperCase()}
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{h.meta.translatedText}</p>
                      </div>
                    )}
                    <div className="flex gap-2" role="group" aria-label="Action buttons">
                      <Button size="sm" variant="outline" onClick={() => onEditHistory(h)} aria-label={`Edit action for ${h.meta.forename || 'participant'}`}>
                        <Edit className="w-3 h-3 mr-1" aria-hidden="true" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const langInfo = h.meta.translationLanguage ? SUPPORTED_LANGUAGES[h.meta.translationLanguage] : null;
                        const copyText = h.meta.translatedText && langInfo
                          ? `=== ENGLISH ===\n${h.text}\n\n=== ${langInfo.nativeName?.toUpperCase() || h.meta.translationLanguage!.toUpperCase()} ===\n${h.meta.translatedText}`
                          : h.text;
                        navigator.clipboard.writeText(copyText);
                        toast({ title: 'Copied!', description: h.meta.translatedText ? 'Both versions copied.' : undefined });
                      }} aria-label="Copy action text">
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">Copy</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => {
                        onDeleteFromHistory(h.id);
                        toast({ title: 'Deleted' });
                      }} aria-label={`Delete action for ${h.meta.forename || 'participant'}`}>
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <Suspense fallback={<InsightsSkeleton />}>
            <HistoryInsights history={history} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
