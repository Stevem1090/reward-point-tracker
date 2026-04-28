import React, { useState } from 'react';
import { useChores } from '@/hooks/useChores';
import { AddChoreDialog } from '@/components/chores/AddChoreDialog';
import { CategoryAccordion } from '@/components/chores/CategoryAccordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ChoresPage: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
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
  } = useChores(year);

  return (
    <div className="container mx-auto px-4 py-4 max-w-2xl">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold text-kid-purple">Chores</h1>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px] h-11">
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

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">No chores yet.</p>
          <p className="text-sm">Tap "Add chore" to create your first category and chore.</p>
        </div>
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
    </div>
  );
};

export default ChoresPage;
