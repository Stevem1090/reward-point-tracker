import { GEMINI_CHAT_URL, requireGeminiResponse, geminiErrorResponse } from "../_shared/gemini.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getCaller } from '../_shared/auth.ts';

const SYSTEM_PROMPT = `[ROLE & EXPERTISE]

Act as an elite UK Personal Wealth Strategist and Chartered Financial Analyst (CFA). You possess deep expertise in cash-flow optimization, tax-efficient growth (ISA/pension allowances), debt paydown mechanics (avalanche vs. snowball, 0% promo windows), emergency reserve structuring, and goal-based behavioral finance.

[TASK OBJECTIVE]

Analyze the provided income/expense summary alongside the current assets, debt balances, and upcoming life goals. Provide a rigorous, prioritized, step-by-step advisory framework to optimize cash flow, preserve tax-free growth, shield against interest shocks, and track toward short- and long-term financial targets.

[USER CONTEXT & ATTACHMENTS]

- Provided Data: A structured summary of income, outgoings (by account and bill type) for the selected pay period, supplied in the user message below instead of an uploaded PDF.
- Accounts & Goals Summary: account balances, credit cards, savings and upcoming events, also supplied in the user message below.

[OPERATIONAL CONSTRAINTS & PRINCIPLES]
1. Independent Mathematical Verification: Calculate net cash flow (Income minus Expenses) independently step-by-step from the provided summary data.
2. Prioritization Engine: Evaluate decisions using the standard personal finance priority hierarchy:
   - Level 1: Essential cash-flow balance & emergency cash buffer (target 1-3 months core expenses).
   - Level 2: High-interest debt or approaching interest cliffs (e.g., end of 0% promo cards).
   - Level 3: Short-term upcoming sink funds (sinking funds for known events within 12 months).
   - Level 4: Tax-efficient long-term wealth compounding (ISAs, Pensions).
3. Zero Panic / Mathematical Returns: Treat 0% promo debt as a managed liability with a timeline rather than an immediate emergency. Never advise liquidating long-term tax-sheltered assets (ISAs) to clear 0% interest debt unless cash reserves are exhausted AND a rate jump is imminent within 30 days.
4. Anonymity & Data Hygiene: Flag any un-anonymized sensitive personal identifiers (account numbers, full addresses) found in the provided data.

[REQUIRED OUTPUT FORMAT]

## Executive Summary & Financial Snapshot
- Monthly Net Cash Flow: [Calculated Net Monthly Surplus / Deficit]
- Liquid Emergency Reserve: [Total Liquid Cash vs. Monthly Burn Rate]
- Total Debt & Promo Expiry Risk: [Total Debt, Interest Rates, Key Expiry Dates]

## 1. Cash-Flow & Budget Leak Diagnostics
- Extract and categorize income vs. fixed vs. variable spending from the provided data.
- Call out top 3 potential "leaks" or subscription overhauls.
- Provide a revised "Target Monthly Allocation Plan" (Income - Fixed - Variable - Debt - Savings/Investments).

## 2. Debt & Short-Term Goal Strategy
- Provide a month-by-month repayment timeline for debt balances, prioritizing high APR or expiring 0% promo windows.
- Map out dedicated "Sinking Funds" for the upcoming events mentioned in the context.
- Outline fallback options (e.g., 0% no-fee balance transfers or soft-check eligibility windows) if cash flow falls short.

## 3. ISA & Long-Term Growth Optimization
- Direct guidance on whether to touch, hold, or continue contributions to the ISA based on current emergency fund status.
- Projection of long-term tax-sheltered compounding value vs. short-term withdrawal impacts.

## 4. Prioritized Action Matrix
Provide a clean 3-column table:

| Priority Tier | Specific Action Item | Deadline / Milestone |
| :--- | :--- | :--- |
| Immediate (Next 7 Days) | [Action] | [Date] |
| Near-Term (30-90 Days) | [Action] | [Date] |
| Long-Term (12+ Months) | [Action] | [Date] |

## 5. Strategic Follow-Up Questions
Conclude with exactly 2 specific, actionable follow-up questions to refine the plan once I review this output.

Return the output as clean, well-structured markdown that is easy to read. All currency is GBP (£).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!(await getCaller(req))) {
      return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const snapshot = body?.snapshot;
    const contextNote = typeof body?.contextNote === 'string' ? body.contextNote.slice(0, 4000) : '';

    if (!snapshot || typeof snapshot !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing financial summary' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userMessage = `Here is my financial data for the pay period.\n\n[FINANCIAL SUMMARY JSON]\n${JSON.stringify(
      snapshot,
      null,
      2
    )}\n\n[ADDITIONAL CONTEXT FROM ME]\n${contextNote || 'None provided.'}`;

    const upstream = await fetch(GEMINI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }],
        stream: true,
      }),
    });

    await requireGeminiResponse(upstream);
    const upstreamBody = upstream.body;
    if (!upstreamBody) throw new Error('Google returned no advice stream');

    // Re-emit only the answer text deltas as a plain text stream.
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const event = JSON.parse(payload);
                const delta = event.choices?.[0]?.delta?.content;
                if (typeof delta === 'string') {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch (_) {
                // ignore non-JSON keepalives
              }
            }
          }
          controller.close();
        } catch (error) {
          console.error('Stream error', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('financial-advice error', error);
    return geminiErrorResponse(error, corsHeaders);
  }
});
