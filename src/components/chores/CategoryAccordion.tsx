import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CategoryWithChores } from '@/types/chore';
import { ChoreCard } from './ChoreCard';
import { AdhocChoreRow } from './AdhocChoreRow';
import { Badge } from '@/components/ui/badge';

interface CategoryAccordionProps {
  data: CategoryWithChores[];
  year: number;
  onLog: (id: string) => void;
  onUndo: (id: string, start: Date, end: Date) => void;
  onDelete: (id: string) => void;
  onToggleAdhoc: (chore: any) => void;
}

export const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  data,
  year,
  onLog,
  onUndo,
  onDelete,
  onToggleAdhoc,
}) => {
  // Hide categories with no chores from the main view
  const visible = data.filter((d) => d.chores.length > 0);

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No chores yet. Tap "Add chore" to get started.
      </p>
    );
  }

  return (
    <Accordion type="multiple" className="w-full space-y-2">
      {visible.map(({ category, chores, completedThisWeek, totalRepeating }) => (
        <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-3 bg-card">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center justify-between w-full pr-2 gap-2">
              <span className="font-semibold text-base truncate">{category.name}</span>
              {totalRepeating > 0 && (
                <Badge
                  variant={completedThisWeek === totalRepeating ? 'default' : 'secondary'}
                  className="ml-2 shrink-0"
                >
                  {completedThisWeek}/{totalRepeating} this week
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            {chores
              .filter((c) => c.frequency !== 'adhoc')
              .map((c) => (
                <ChoreCard
                  key={c.id}
                  chore={c}
                  year={year}
                  onLog={onLog}
                  onUndo={onUndo}
                  onDelete={onDelete}
                />
              ))}
            {chores
              .filter((c) => c.frequency === 'adhoc')
              .map((c) => (
                <AdhocChoreRow key={c.id} chore={c} onToggle={onToggleAdhoc} onDelete={onDelete} />
              ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
