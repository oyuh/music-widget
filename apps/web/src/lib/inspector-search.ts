export interface InspectorSearchItem {
  label: string;
  section: string;
  terms?: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/** Small typo-tolerant matcher for the inspector's short, local settings list. */
export function matchesInspectorSearch(item: InspectorSearchItem, query: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;

  const haystack = normalize(`${item.label} ${item.section} ${item.terms ?? ""}`);
  if (haystack.includes(needle)) return true;

  const words = haystack.split(" ");
  return needle.split(" ").every((token) =>
    words.some((word) => {
      if (word.includes(token) || (word.length >= 3 && token.includes(word))) return true;
      const allowance = token.length > 6 ? 2 : token.length > 4 ? 1 : 0;
      return allowance > 0 && Math.abs(word.length - token.length) <= allowance && distance(token, word) <= allowance;
    }),
  );
}
