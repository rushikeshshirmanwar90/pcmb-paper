/**
 * Column widths for a table drawn in a box `avail` wide (math tables in
 * questions, e.g. match-the-column). Each column's `natural` width is what its
 * widest cell needs on one line.
 *
 * - Everything fits: the natural widths, unchanged.
 * - Too wide: narrow columns keep their natural width and the wide ones share
 *   what is left (their text wraps), so the table is exactly `avail` wide.
 * - Even the minimum doesn't fit (many columns on a small phone): every column
 *   gets `min`, and the table scrolls sideways in its box.
 *
 * `extra` is each column's padding and border, which wrapping can't shrink.
 */
export function fitColumns(natural: number[], avail: number, { min = 48, extra = 0 }: { min?: number; extra?: number } = {}): number[] {
  const n = natural.length;
  if (!n) return [];
  const need = natural.map((w) => Math.max(0, w));
  const total = need.reduce((a, b) => a + b, 0);
  if (!(avail > 0) || total <= avail) return need;

  const room = avail - extra * n; // content width the columns can share
  const floor = Math.max(1, min - extra);
  if (room <= floor * n) return need.map(() => floor + extra);

  // Water-filling: columns needing less than an equal share keep their size;
  // the rest split what remains equally.
  const width: number[] = new Array(n).fill(0);
  let open = need.map((w, i) => ({ i, w: Math.max(floor, w - extra) }));
  let left = room;
  for (;;) {
    const share = left / open.length;
    const small = open.filter((c) => c.w <= share);
    if (!small.length) {
      for (const c of open) width[c.i] = share;
      break;
    }
    for (const c of small) {
      width[c.i] = c.w;
      left -= c.w;
    }
    open = open.filter((c) => c.w > share);
    if (!open.length) break;
  }
  return width.map((w) => Math.floor(Math.max(floor, w) + extra));
}
