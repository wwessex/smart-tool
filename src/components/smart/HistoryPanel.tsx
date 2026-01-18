import { memo, useState, useMemo, lazy, Suspense } from 'react';
import { History, BarChart3, Trash2, Copy, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { HistoryItem } from '@/hooks/useSmartStorage';

// Lazy load HistoryInsights as it uses recharts which is a heavy dependency
const HistoryInsights = lazy(() => import('./HistoryInsights').then(module => ({ default: module.HistoryInsights })));

// Skeleton loader for lazy-loaded components
const InsightsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 rounded-xl bg-muted" />
      ))}
    </div>
    <div className="h-48 rounded-xl bg-muted" />
  </div>
);

export interface HistoryPanelProps {
  history: HistoryItem[];
  onEditHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onClearHistory: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToast: (options: { title: string; description?: string }) => void;
}

export const HistoryPanel = memo(function HistoryPanel({
  history,
  onEditHistory,
  onDeleteHistory,
  onClearHistory,
  onExport,
  onImport,
  onToast,
}: HistoryPanelProps) {
  const [historyTab, setHistoryTab] = useState<'history' | 'insights'>('history');
  const [historySearch, setHistorySearch] = useState('');

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    if (!q) return history;
    return history.filter(h =>
      h.text.toLowerCase().includes(q) ||
      h.meta.forename?.toLowerCase().includes(q) ||
      h.meta.barrier?.toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  const handleCopyItem = async (text: string) => {
    await navigator.clipboard.writeText(text);
    onToast({ title: 'Copied!' });
  };

  const handleDeleteItem = (id: string) => {
    onDeleteHistory(id);
    onToast({ title: 'Deleted' });
  };

  const handleClearAll = () => {
    onClearHistory();
    onToast({ title: 'Cleared', description: 'History cleared.' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-bold text-lg">History</h2>
        <div className="flex gap-2 flex-wrap">
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
            onClick={handleClearAll}
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
              <div className="p-6 rounded-xl border-2 border-dashed text-sm text-muted-foreground text-center">
                {historySearch ? 'No matching items found.' : 'No saved items yet. Generate and save actions to build your history.'}
              </div>
            ) : (
              <ul role="list" aria-label="Saved actions history">
                {filteredHistory.map((h, index) => (
                  <li 
                    key={h.id} 
                    className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-3 hover:border-primary/30 transition-colors animate-slide-in mb-3 last:mb-0"
                    style={{ animationDelay: `${index * 0.05}s` }}
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
                    <div className="flex gap-2" role="group" aria-label="Action buttons">
                      <Button size="sm" variant="outline" onClick={() => onEditHistory(h)} aria-label={`Edit action for ${h.meta.forename || 'participant'}`}>
                        <Edit className="w-3 h-3 mr-1" aria-hidden="true" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCopyItem(h.text)} aria-label="Copy action text">
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">Copy</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteItem(h.id)} aria-label={`Delete action for ${h.meta.forename || 'participant'}`}>
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </li>
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
});
