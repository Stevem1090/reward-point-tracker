import React, { useState } from 'react';
import { useChores } from '@/hooks/useChores';
import { AddChoreDialog } from '@/components/chores/AddChoreDialog';
import { CategoryAccordion } from '@/components/chores/CategoryAccordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2, Settings2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ChoresPage: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingDeleteCat, setPendingDeleteCat] = useState<{ id: string; name: string } | null>(null);
  const {
    loading,
    categories,
    grouped,
    availableYears,
    addCategory,
    addChore,
    logCompletion,
    undoLastCompletionInPeriod,
    toggleAdhocComplete,
    deleteChore,
    deleteCategory,
  } = useChores(year);

  const choreCountByCategory = (cid: string) =>
    grouped.find((g) => g.category.id === cid)?.chores.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-4 max-w-2xl">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h1 className="text-2xl font-bold text-kid-purple">Chores</h1>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddChoreDialog categories={categories} onAddChore={addChore} onAddCategory={addCategory} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Double-tap a grid to log · Long-press to undo this week/month
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <CategoryAccordion
          data={grouped}
          year={year}
          onLog={logCompletion}
          onUndo={undoLastCompletionInPeriod}
          onDelete={deleteChore}
          onToggleAdhoc={toggleAdhocComplete}
        />
      )}

      {categories.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Sheet open={manageOpen} onOpenChange={setManageOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Settings2 className="h-4 w-4 mr-1.5" /> Manage categories
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>Manage categories</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No categories yet.</p>
                )}
                {categories.map((c) => {
                  const count = choreCountByCategory(c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {count} chore{count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setPendingDeleteCat({ id: c.id, name: c.name })}
                        aria-label={`Delete category ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      <AlertDialog open={!!pendingDeleteCat} onOpenChange={(o) => !o && setPendingDeleteCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDeleteCat?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteCat && choreCountByCategory(pendingDeleteCat.id) > 0
                ? 'This category still contains chores. Move or delete them first.'
                : 'This will permanently remove the category.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !!pendingDeleteCat && choreCountByCategory(pendingDeleteCat.id) > 0
              }
              onClick={async () => {
                if (pendingDeleteCat) {
                  await deleteCategory(pendingDeleteCat.id);
                  setPendingDeleteCat(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChoresPage;
