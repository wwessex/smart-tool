import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { 
  Sun, Moon, Monitor, ChevronDown, ChevronUp, 
  HelpCircle, Settings, Keyboard, ShieldCheck, 
  Wand2, Clock, Shield, FileDown, Trash2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WarningBox } from './WarningBox';
import { GUIDANCE } from '@/lib/smart-data';
import { safeRemoveItem } from '@/lib/storage-utils';
import { cn } from '@/lib/utils';
import type { useSmartStorage } from '@/hooks/useSmartStorage';

export interface SmartHeaderProps {
  isLandscape: boolean;
  headerCollapsed: boolean;
  setHeaderCollapsed: (collapsed: boolean) => void;
  wizardMode: boolean;
  setWizardMode: (mode: boolean) => void;
  storage: ReturnType<typeof useSmartStorage>;
  aiHasConsent: boolean;
  onOpenShortcutsHelp: () => void;
  onOpenPrivacySettings: () => void;
  onToast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

export const SmartHeader = memo(function SmartHeader({
  isLandscape,
  headerCollapsed,
  setHeaderCollapsed,
  wizardMode,
  setWizardMode,
  storage,
  aiHasConsent,
  onOpenShortcutsHelp,
  onOpenPrivacySettings,
  onToast,
}: SmartHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBarriers, setSettingsBarriers] = useState('');
  const [settingsTimescales, setSettingsTimescales] = useState('');

  const handleExportData = () => {
    const data = storage.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-action-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast({ title: 'Data exported', description: 'Your data has been downloaded.' });
  };

  const handleDeleteAllData = () => {
    if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
      storage.deleteAllData();
      onToast({ title: 'Data deleted', description: 'All your data has been removed.' });
      window.location.reload();
    }
  };

  const handleReplayTutorial = () => {
    safeRemoveItem('smartTool.onboardingComplete');
    setSettingsOpen(false);
    window.location.reload();
  };

  const handleSaveBarriers = () => {
    const list = settingsBarriers.split('\n').map(s => s.trim()).filter(Boolean);
    if (!list.length) {
      onToast({ title: 'Error', description: 'Barriers list cannot be empty.', variant: 'destructive' });
      return;
    }
    storage.updateBarriers(Array.from(new Set(list)));
    onToast({ title: 'Saved', description: 'Barriers updated.' });
  };

  const handleSaveTimescales = () => {
    const list = settingsTimescales.split('\n').map(s => s.trim()).filter(Boolean);
    if (!list.length) {
      onToast({ title: 'Error', description: 'Timescales list cannot be empty.', variant: 'destructive' });
      return;
    }
    storage.updateTimescales(Array.from(new Set(list)));
    onToast({ title: 'Saved', description: 'Timescales updated.' });
  };

  return (
    <motion.header 
      className="sticky top-0 z-50 backdrop-blur-xl bg-background/90 border-b border-border shadow-sm"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className={cn(
        "max-w-7xl mx-auto px-2 sm:px-4 flex items-center justify-between transition-all duration-200 overflow-hidden",
        isLandscape && headerCollapsed ? "py-1" : isLandscape ? "py-2" : "py-3 sm:py-4"
      )}>
        {/* Logo and Title */}
        <motion.div 
          className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div 
            className={cn(
              "rounded-xl gradient-primary flex items-center justify-center text-white font-black shadow-glow transition-all duration-200 flex-shrink-0",
              isLandscape && headerCollapsed ? "w-7 h-7 text-sm" : isLandscape ? "w-8 h-8 text-base" : "w-9 h-9 sm:w-11 sm:h-11 text-lg sm:text-xl"
            )}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            S
          </motion.div>
          <AnimatePresence mode="wait">
            {!(isLandscape && headerCollapsed) && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden min-w-0"
              >
                <h1 className={cn(
                  "font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate",
                  isLandscape ? "text-base" : "text-sm sm:text-xl"
                )}>
                  <span className="hidden xs:inline">SMART Action Support Tool</span>
                  <span className="xs:hidden">SMART Tool</span>
                </h1>
                {!isLandscape && <p className="text-xs text-muted-foreground hidden sm:block">by William Wessex</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Header Actions */}
        <div className="flex gap-0.5 sm:gap-1 items-center flex-shrink-0">
          {/* Collapse toggle - only show in landscape */}
          {isLandscape && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setHeaderCollapsed(!headerCollapsed)}
              aria-label={headerCollapsed ? "Expand header" : "Collapse header"}
              className="px-1.5 sm:px-2 h-8"
            >
              {headerCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          )}
          
          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Toggle theme" className="px-1.5 sm:px-2 h-8">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="w-4 h-4 mr-2" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="w-4 h-4 mr-2" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="w-4 h-4 mr-2" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Guidance Dialog */}
          <Dialog open={guidanceOpen} onOpenChange={setGuidanceOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="px-1.5 sm:px-2 h-8">
                <HelpCircle className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">Guidance</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
              <DialogHeader className="shrink-0">
                <DialogTitle>Guidance</DialogTitle>
              </DialogHeader>
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                {GUIDANCE.map((g, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-card">
                    <h3 className="font-bold mb-2">{g.title}</h3>
                    {Array.isArray(g.body) ? (
                      <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                        {g.body.map((item, j) => <li key={j}>{item}</li>)}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{g.body}</p>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Shortcuts Button */}
          <Button 
            data-tutorial="shortcuts"
            variant="ghost" 
            size="sm" 
            className="px-1.5 sm:px-2 h-8" 
            onClick={onOpenShortcutsHelp}
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </Button>

          {/* Settings Dialog */}
          <Dialog open={settingsOpen} onOpenChange={(open) => {
            setSettingsOpen(open);
            if (open) {
              setSettingsBarriers(storage.barriers.join('\n'));
              setSettingsTimescales(storage.timescales.join('\n'));
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="px-1.5 sm:px-2 h-8">
                <Settings className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">Settings</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
              <DialogHeader className="shrink-0">
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {/* Barriers and Timescales */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <h3 className="font-bold">Barriers list</h3>
                    <p className="text-xs text-muted-foreground">One per line. Users can still type custom barriers.</p>
                    <Textarea 
                      value={settingsBarriers} 
                      onChange={e => setSettingsBarriers(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        storage.resetBarriers();
                        setSettingsBarriers(storage.barriers.join('\n'));
                        onToast({ title: 'Reset', description: 'Barriers reset to default.' });
                      }}>Reset</Button>
                      <Button size="sm" onClick={handleSaveBarriers}>Save</Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <h3 className="font-bold">Timescales</h3>
                    <p className="text-xs text-muted-foreground">One per line.</p>
                    <Textarea 
                      value={settingsTimescales} 
                      onChange={e => setSettingsTimescales(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        storage.resetTimescales();
                        setSettingsTimescales(storage.timescales.join('\n'));
                        onToast({ title: 'Reset', description: 'Timescales reset to default.' });
                      }}>Reset</Button>
                      <Button size="sm" onClick={handleSaveTimescales}>Save</Button>
                    </div>
                  </div>
                </div>
              
                {/* Quality Enforcement Section */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Quality Enforcement</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prevent saving actions that don't meet SMART quality standards.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={storage.minScoreEnabled} 
                        onChange={e => storage.updateMinScoreEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">Enforce minimum SMART score</span>
                    </label>
                    
                    {storage.minScoreEnabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Minimum score:</span>
                        <Select 
                          value={String(storage.minScoreThreshold)} 
                          onValueChange={v => storage.updateMinScoreThreshold(parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3/5</SelectItem>
                            <SelectItem value="4">4/5</SelectItem>
                            <SelectItem value="5">5/5</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <WarningBox show={storage.minScoreEnabled} variant="warning">
                    Actions with a SMART score below {storage.minScoreThreshold}/5 cannot be saved to history. 
                    This encourages higher quality action writing.
                  </WarningBox>
                </div>

                {/* Wizard Mode Toggle */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Guided Wizard Mode</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Step-by-step guided form that walks you through creating a SMART action.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={wizardMode} 
                      onChange={e => setWizardMode(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Enable guided wizard mode</span>
                  </label>
                </div>

                {/* Tutorial Reset */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Tutorial</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Replay the onboarding tutorial to learn about key features.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleReplayTutorial}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Replay Tutorial
                  </Button>
                </div>

                {/* Data Retention Section */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Data Retention</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete old history items to comply with data minimisation principles.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={storage.retentionEnabled} 
                        onChange={e => storage.updateRetentionEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">Auto-delete old actions</span>
                    </label>
                    
                    {storage.retentionEnabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Keep for:</span>
                        <Select 
                          value={String(storage.retentionDays)} 
                          onValueChange={v => storage.updateRetentionDays(parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  {storage.retentionEnabled && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Actions older than {storage.retentionDays} days will be automatically deleted when you open the app. 
                        You currently have {storage.history.length} action{storage.history.length === 1 ? '' : 's'} in history.
                      </p>
                    </div>
                  )}
                </div>

                {/* Privacy & Data Section - GDPR Compliance */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">Privacy & Data</h3>
                    </div>
                    {/* AI Consent Status Badge */}
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                      aiHasConsent
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        aiHasConsent ? "bg-emerald-500" : "bg-amber-500"
                      )} />
                      AI: {aiHasConsent ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manage your data and privacy preferences in accordance with UK GDPR.
                  </p>
                  
                  <div className="grid gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleExportData}
                      className="gap-2 justify-start"
                    >
                      <FileDown className="w-4 h-4" />
                      Export All My Data
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={onOpenPrivacySettings}
                      className="gap-2 justify-start"
                    >
                      <Shield className="w-4 h-4" />
                      Manage Cookie Preferences
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleDeleteAllData}
                      className="gap-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete All My Data
                    </Button>
                  </div>
                  
                  <a 
                    href="#/privacy" 
                    className="text-xs text-primary hover:underline block mt-2"
                    onClick={() => setSettingsOpen(false)}
                  >
                    View Privacy Policy →
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </motion.header>
  );
});
