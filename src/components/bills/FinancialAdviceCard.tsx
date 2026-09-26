import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';
import { useBillAccounts } from '@/hooks/useBillAccounts';
import { PayPeriodSummary } from '@/types/bill';
import { buildFinancialSnapshot } from '@/utils/financialSnapshot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Copy, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { exportAdviceToPdf } from '@/utils/billExport';

interface Props {
  summary: PayPeriodSummary;
  periodLabel: string;
}

const markdownComponents = {
  h1: (props: any) => <h2 className="text-xl font-bold mt-6 mb-2" {...props} />,
  h2: (props: any) => <h3 className="text-lg font-semibold mt-6 mb-2" {...props} />,
  h3: (props: any) => <h4 className="text-base font-semibold mt-4 mb-1" {...props} />,
  p: (props: any) => <p className="text-sm leading-relaxed mb-3" {...props} />,
  ul: (props: any) => <ul className="list-disc pl-5 space-y-1 text-sm mb-3" {...props} />,
  ol: (props: any) => <ol className="list-decimal pl-5 space-y-1 text-sm mb-3" {...props} />,
  li: (props: any) => <li className="leading-relaxed" {...props} />,
  strong: (props: any) => <strong className="font-semibold" {...props} />,
  hr: () => <hr className="my-4 border-border" />,
  table: (props: any) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  th: (props: any) => (
    <th className="border-b px-3 py-2 text-left font-semibold align-top" {...props} />
  ),
  td: (props: any) => <td className="border-b px-3 py-2 align-top" {...props} />,
};

export const FinancialAdviceCard = ({ summary, periodLabel }: Props) => {
  const { accounts } = useBillAccounts();
  const [contextNote, setContextNote] = useState('');
  const [advice, setAdvice] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Load the most recent saved advice for this period
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('financial_advice_runs')
        .select('*')
        .eq('period_label', periodLabel)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (data) {
        setAdvice((data as any).advice_markdown || '');
        setContextNote((data as any).context_note || '');
        setLoadedExisting(true);
      } else {
        setAdvice('');
        setLoadedExisting(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [periodLabel]);

  const generate = async () => {
    setLoading(true);
    setAdvice('');
    const snapshot = buildFinancialSnapshot(summary, accounts, periodLabel);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        'https://ehhycpszdjhdqsorriun.supabase.co/functions/v1/financial-advice',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ snapshot, contextNote }),
        }
      );

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Could not generate advice');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setAdvice(full);
        outputRef.current?.scrollIntoView({ block: 'nearest' });
      }

      if (!full.trim()) {
        throw new Error('The adviser returned an empty response. Please try again.');
      }

      await supabase.from('financial_advice_runs').insert({
        period_label: periodLabel,
        context_note: contextNote,
        summary_snapshot: snapshot as any,
        advice_markdown: full,
      });
      setLoadedExisting(true);
    } catch (error: any) {
      console.error('Advice error', error);
      toast.error(error?.message || 'Could not generate advice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI financial advice
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Reviews this pay period's income, outgoings and your account balances.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="advice_context">Anything else worth knowing?</Label>
          <Textarea
            id="advice_context"
            placeholder="Upcoming events, birthdays, holidays, savings goals, planned purchases..."
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Thinking...
              </>
            ) : loadedExisting || advice ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run again
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Get AI advice
              </>
            )}
          </Button>
          {advice && !loading && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(advice);
                  toast.success('Advice copied');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" onClick={() => exportAdviceToPdf(advice, periodLabel)}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </>
          )}
        </div>

        {loading && !advice && (
          <p className="text-sm text-muted-foreground">
            Crunching the numbers — this can take a minute or two.
          </p>
        )}

        {advice && (
          <div ref={outputRef} className="border-t pt-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {advice}
            </ReactMarkdown>
            <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
              This is AI-generated guidance for information only, not regulated financial advice.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
