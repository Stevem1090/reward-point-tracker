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
  return (
    <Accordion type="multiple" defaultValue={data.map((d) => d.category.id)} className="w-full space-y-2">
      {data.map(({ category, chores, completedThisWeek, totalRepeating }) => (
        <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-3 bg-card">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center justify-between w-full pr-2">
              <span className="font-semibold text-base">{category.name}</span>
              {totalRepeating > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {completedThisWeek}/{totalRepeating} done this week
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            {chores.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No chores yet in this category.</p>
            )}
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
