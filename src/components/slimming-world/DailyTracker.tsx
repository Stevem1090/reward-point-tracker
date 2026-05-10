import { useState, useMemo } from 'react';
import { format, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronLeft, ChevronRight, Plus, Trash2, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwLog, getWeekStartMonday, getWeekDays, formatDate } from '@/hooks/useSwLog';
import { computeDailyTotals, entryOverflowed, round1 } from '@/utils/slimmingWorldCalculations';
import { SWIPS_DAILY_LIMIT, HEALTHY_EXTRA_LABELS, HEALTHY_EXTRA_TYPES, HealthyExtraType } from '@/types/slimmingWorld';
import { AddEntryDialog } from './AddEntryDialog';

export function DailyTracker() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStartMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const { entries, deleteEntry, isLoading } = useSwLog(weekStart);
  const [addOpen, setAddOpen] = useState(false);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const selectedKey = formatDate(selectedDate);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.log_date === selectedKey),
    [entries, selectedKey]
  );

  const totals = useMemo(() => computeDailyTotals(dayEntries), [dayEntries]);
  const overLimit = totals.swips > SWIPS_DAILY_LIMIT;

  const goPrev = () => {
    const ns = subWeeks(weekStart, 1);
    setWeekStart(ns);
    setSelectedDate(ns);
  };
  const goNext = () => {
    const ns = addWeeks(weekStart, 1);
    setWeekStart(ns);
    setSelectedDate(ns);
  };

  return (
    <div className="space-y-4">
      {/* Week strip */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between mb-2">
            <Button size="icon" variant="ghost" onClick={goPrev}><ChevronLeft className="h-5 w-5" /></Button>
            <div className="text-sm font-medium">
              {format(weekDays[0], 'd MMM')} – {format(weekDays[6], 'd MMM yyyy')}
            </div>
            <Button size="icon" variant="ghost" onClick={goNext}><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const sel = isSameDay(d, selectedDate);
              const td = isToday(d);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md py-2 min-h-[52px] text-xs transition-colors",
                    sel ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    td && !sel && "ring-1 ring-primary"
                  )}
                >
                  <span className="opacity-70">{format(d, 'EEE')[0]}</span>
                  <span className="text-base font-semibold leading-none mt-0.5">{format(d, 'd')}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily summary */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Swips today</div>
              <div className={cn(
                "text-4xl font-bold tabular-nums",
                overLimit ? "text-red-600" : "text-foreground"
              )}>
                {round1(totals.swips)}
                <span className="text-base font-normal text-muted-foreground"> / {SWIPS_DAILY_LIMIT}</span>
              </div>
              {overLimit && (
                <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertTriangle className="h-3 w-3" /> Over daily limit
                </div>
              )}
            </div>
            {totals.speedCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                <Zap className="h-3 w-3 mr-1" /> {totals.speedCount} Speed
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {HEALTHY_EXTRA_TYPES.map((he: HealthyExtraType) => {
              const used = totals.healthyExtras[he];
              const pct = Math.min(100, used * 100);
              return (
                <div key={he}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{HEALTHY_EXTRA_LABELS[he]}</span>
                    <span className="tabular-nums text-muted-foreground">{round1(used)} / 1.0</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>

          <Button className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add food / meal
          </Button>
        </CardContent>
      </Card>

      {/* Entries accordion */}
      <Accordion type="single" collapsible defaultValue="" className="border rounded-lg">
        <AccordionItem value="entries" className="border-b-0">
          <AccordionTrigger className="px-4">
            {dayEntries.length} item{dayEntries.length === 1 ? '' : 's'} logged
          </AccordionTrigger>
          <AccordionContent className="px-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <div className="space-y-2">
                {dayEntries.map((e) => {
                  const overflowed = entryOverflowed(e, dayEntries);
                  return (
                    <div key={e.id} className="flex items-center gap-2 border rounded-md p-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {e.name_snapshot}
                          {e.quantity !== 1 && <span className="text-muted-foreground"> × {round1(Number(e.quantity))}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Number(e.swips_snapshot) > 0 && (
                            <Badge variant="secondary" className="text-xs">{round1(Number(e.swips_snapshot) * Number(e.quantity))} swips</Badge>
                          )}
                          {e.healthy_extra_type_snapshot && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              HE {HEALTHY_EXTRA_LABELS[e.healthy_extra_type_snapshot]} {round1(Number(e.healthy_extra_amount_snapshot) * Number(e.quantity))}
                            </Badge>
                          )}
                          {e.is_speed_snapshot && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              <Zap className="h-3 w-3 mr-0.5" /> Speed
                            </Badge>
                          )}
                          {overflowed && (
                            <Badge variant="outline" className="text-xs text-red-700 border-red-200">
                              HE limit reached → counted as Swips
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteEntry.mutate(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <AddEntryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        logDate={selectedKey}
        weekStart={weekStart}
      />
    </div>
  );
}
