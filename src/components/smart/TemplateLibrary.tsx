import { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, Plus, Trash2, Edit2, Check, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface ActionTemplate {
  id: string;
  name: string;
  mode: 'now' | 'future';
  createdAt: string;
  time?: string;
  // For "now" mode
  barrier?: string;
  action?: string;
  responsible?: string;
  help?: string;
  // For "future" mode  
  task?: string;
  outcome?: string;
}

interface TemplateLibraryProps {
  templates: ActionTemplate[];
  onSaveTemplate: (template: Omit<ActionTemplate, 'id' | 'createdAt'>) => void;
  onDeleteTemplate: (id: string) => void;
  onInsertTemplate: (template: ActionTemplate) => void;
  currentMode: 'now' | 'future';
  currentForm: {
    time?: string;
    barrier?: string;
    action?: string;
    responsible?: string;
    help?: string;
    task?: string;
    outcome?: string;
  };
}

// BUG FIX #1: Use forwardRef to prevent React warning about refs on function components
export const TemplateLibrary = forwardRef<HTMLDivElement, TemplateLibraryProps>(function TemplateLibrary({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onInsertTemplate,
  currentMode,
  currentForm,
}, ref) {
  const { toast } = useToast();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Backwards compatible: treat anything other than 'now' as 'future'
  const normalizedMode = (m: any): 'now' | 'future' => (m === 'now' ? 'now' : 'future');
  const filteredTemplates = templates.filter(t => normalizedMode((t as any).mode) === currentMode);

  const handleSave = () => {
    if (!templateName.trim()) {
      toast({ title: 'Name required', description: 'Enter a name for your template.', variant: 'destructive' });
      return;
    }

    const hasContent = currentMode === 'now' 
      ? (currentForm.action?.trim() || currentForm.help?.trim())
      : (currentForm.task?.trim() || currentForm.outcome?.trim());

    if (!hasContent) {
      toast({ title: 'No content', description: 'Add some content to the form before saving as template.', variant: 'destructive' });
      return;
    }

    onSaveTemplate({
      name: templateName.trim(),
      mode: currentMode,
      time: currentForm.time,
      barrier: currentForm.barrier,
      action: currentForm.action,
      responsible: currentForm.responsible,
      help: currentForm.help,
      task: currentForm.task,
      outcome: currentForm.outcome,
    });

    setTemplateName('');
    setSaveOpen(false);
    toast({ title: 'Template saved', description: 'Your template has been saved to the library.' });
  };

  const handleInsert = (template: ActionTemplate) => {
    onInsertTemplate(template);
    setLibraryOpen(false);
    toast({ title: 'Template inserted', description: 'Edit the fields as needed.' });
  };

  return (
    <div ref={ref} className="flex gap-2">
      {/* Save as Template Button */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Save as template
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save the current form as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template name</label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. CV Update Standard"
                autoFocus
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Will save:</p>
              {currentMode === 'now' ? (
                <ul className="list-disc pl-4 space-y-0.5">
                  {currentForm.barrier && <li>Barrier: {currentForm.barrier}</li>}
                  {currentForm.action && <li>Action text</li>}
                  {currentForm.responsible && <li>Responsible: {currentForm.responsible}</li>}
                  {currentForm.help && <li>Help text</li>}
                </ul>
              ) : (
                <ul className="list-disc pl-4 space-y-0.5">
                  {currentForm.task && <li>Task/Activity</li>}
                  {currentForm.outcome && <li>Expected outcome</li>}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleSave}>Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Library Button */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <BookMarked className="w-3.5 h-3.5" />
            Templates
            {filteredTemplates.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-bold">
                {filteredTemplates.length}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Library</DialogTitle>
            <DialogDescription>
              {currentMode === 'now' ? 'Barrier to action' : 'Task-based'} templates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No templates yet</p>
                <p className="text-xs mt-1">Save your first template to build your library.</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredTemplates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    className="p-3 rounded-lg border border-border/50 bg-muted/30 hover:border-primary/30 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {editingId === template.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="text-sm h-8"
                          autoFocus
                        />
                        <Button type="button" 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            // Would need updateTemplate function
                            setEditingId(null);
                          }}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button type="button" 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {new Date(template.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button type="button" 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingId(template.id);
                                setEditName(template.name);
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button type="button" 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                onDeleteTemplate(template.id);
                                toast({ title: 'Template deleted' });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground space-y-1 mb-3">
                          {template.barrier && (
                            <p className="truncate"><span className="font-medium">Barrier:</span> {template.barrier}</p>
                          )}
                          {template.action && (
                            <p className="truncate"><span className="font-medium">Action:</span> {template.action.slice(0, 60)}...</p>
                          )}
                          {template.task && (
                            <p className="truncate"><span className="font-medium">Task:</span> {template.task}</p>
                          )}
                          {template.outcome && (
                            <p className="truncate"><span className="font-medium">Outcome:</span> {template.outcome.slice(0, 60)}...</p>
                          )}
                        </div>

                        <Button type="button" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleInsert(template)}
                        >
                          Use this template
                        </Button>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
