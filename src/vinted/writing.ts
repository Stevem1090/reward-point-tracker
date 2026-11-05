/** Advisory checks only: never feed these warnings into approval validation. */
export function writingWarnings(description: string, conditionId: number | null, notes = ''): string[] {
  const warnings: string[] = [];
  const text = description.trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (text.split(/\s+/).filter(Boolean).length > 45) warnings.push('Description is over 45 words.');
  if (lines.length > 3) warnings.push('Description has more than 3 lines.');
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(text)) warnings.push('Remove emojis from the description.');
  if (/#|\*|`|\[[^\]]+\]\(|^\s*(?:[-+]\s|>)/m.test(text)) warnings.push('Remove hashtags or markdown from the description.');
  if (/\b[A-Z]{3,}\b/.test(text)) warnings.push('Description contains an all-capitals word.');
  const normalise = (s: string) => s.toLowerCase().replace(/[-\s]+/g, ' ');
  for (const phrase of ['my son', 'my daughter', 'smoke free', 'pet free', 'worn once']) {
    const pattern = new RegExp(`\\b${phrase}\\b`);
    if (pattern.test(normalise(text)) && !pattern.test(normalise(notes))) warnings.push(`“${phrase}” is not supported by your notes.`);
  }
  const final = lines[lines.length - 1] ?? '';
  const matches: Record<number, RegExp> = {
    6: /brand new with tags/i,
    1: /brand new,? never worn/i,
    2: /great condition|fab condition|hardly worn/i,
    3: /good,? used condition|well worn,? but/i,
    4: /really worn[\s\S]*but[\s\S]+/i,
  };
  if (conditionId != null && matches[conditionId] && !matches[conditionId].test(final)) warnings.push('The final line may not match the chosen condition.');
  return warnings;
}

export const WRITING_RULES = `Write like a busy parent clearing out a wardrobe: short, friendly, honest, British English.
The explicit rules below override inconsistencies in the real-listing examples.

DESCRIPTION:
- Plain text, 1 to 3 short lines, normally 5 to 25 words; hard maximum 45 words (extra space for a flaw from Notes). No markdown, emojis, hashtags or ALL CAPS words.
- Warm opener naming the item (e.g. Lovely hoody.), optionally ONE useful buyer detail, then condition LAST. Include every supported flaw plainly in that final line, including its location. Add "see picture" ONLY if a photo shows it. Never invent, hide or soften a flaw.
- Do not repeat form fields: brand, size, colour, category, material or price, except useful extra information such as the printed age range, tog rating or what is included in a multipack. For licensed characters a brand may appear in the description only if it adds value.
- No fabric composition, measurements, care instructions or marketing language.
- Before returning, check the final line against the exact condition patterns below; for Satisfactory the word "but" is required. Delete repeated colour/brand/size from description even when they appeared in the examples. One useful detail means ONE, not a list of features.
- Final condition line must match the chosen condition: 6 "Brand new with tags."; 1 "Brand new, never worn."; 2 vary "Great condition." / "Fab condition." / "Hardly worn."; 3 "Good, used condition." or "Well worn, but [honest positive use]."; 4 "Really worn [cosmetically / in places] but [still good for X]." For 4 always include a truthful positive use supported by the item, never claim structural soundness without evidence.
- NEVER invent personal or situational facts: no my son/daughter, worn once, smoke-free/pet-free home or bundle discount unless supplied in Notes. Say only what photos, labels or Notes support.
- Vary wording across batch items: Lovely, Great, Really fab, Fabulous, Awesome, Really soft and cosy (only when supported). Do not copy reference sentences word for word. Multipacks/bundles: state what is included.

TITLE:
- Sentence case, parts separated with " - ": [colour, character or distinguishing feature] [item] - [brand if useful] - [age or size]. Keep about 60 characters or fewer.
- Include brand when useful. Licensed characters: lead with licence (Marvel, Jurassic World), not brand.
- Years: "Age 6". Months as printed: "12/18 months" or "Age 12/18 months". Shoes: UK child size from Vinted size label, number before child/baby/junior, e.g. "size 11"; NEVER EU size.
- Preserve the label's actual age endpoints: a label saying 6-18 months must not become 6/18 months. If label evidence differs from the selected form size, prefer that evidence in the title.
- No words of 3+ capital letters (no BNWT). Brands normal case: Tu, Next, H&M.
`;