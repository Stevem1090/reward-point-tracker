import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, GripVertical } from 'lucide-react';

interface StepsEditorProps {
  steps: string[];
  onChange: (steps: string[]) => void;
}

export function StepsEditor({ steps, onChange }: StepsEditorProps) {
  const updateStep = (index: number, value: string) => {
    const updated = [...steps];
    updated[index] = value;
    onChange(updated);
  };

  const addStep = () => {
    onChange([...steps, '']);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= steps.length) return;
    
    const updated = [...steps];
    [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex flex-col items-center gap-0.5 pt-2">
            <span className="text-sm font-medium text-muted-foreground w-6 text-center">
              {index + 1}.
            </span>
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-6 text-muted-foreground"
                onClick={() => moveStep(index, 'up')}
                disabled={index === 0}
              >
                <GripVertical className="h-3 w-3 rotate-90" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-6 text-muted-foreground"
                onClick={() => moveStep(index, 'down')}
                disabled={index === steps.length - 1}
              >
                <GripVertical className="h-3 w-3 rotate-90" />
              </Button>
            </div>
          </div>
          <Textarea
            value={step}
            onChange={(e) => updateStep(index, e.target.value)}
            placeholder={`Step ${index + 1}...`}
            className="flex-1 min-h-[60px] text-sm resize-none"
            rows={2}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-1"
            onClick={() => removeStep(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={addStep}
      >
        <Plus className="h-4 w-4" />
        Add Step
      </Button>
    </div>
  );
}
