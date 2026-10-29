import katex from 'katex';

/**
 * One MathML element from KaTeX's output. Leaf elements (mi, mn, mo, mtext)
 * carry their characters in `text`; the others carry `children`.
 */
export type MNode = {
  tag: string;
  attrs: Record<string, string>;
  children: MNode[];
  text: string;
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

const TOKEN_RE = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
const ATTR_RE = /([\w:-]+)="([^"]*)"/g;

/** Parses KaTeX's well-formed MathML string into a tree. */
function parseMarkup(markup: string): MNode {
  const root: MNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: MNode[] = [root];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(markup)) !== null) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      top.text += decode(m[5]);
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      // Closing tag: pop back to its opening tag.
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(ATTR_RE)) attrs[a[1]] = decode(a[2]);
    const node: MNode = { tag, attrs, children: [], text: '' };
    top.children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

function findMath(node: MNode): MNode | null {
  if (node.tag === 'math') return node;
  for (const child of node.children) {
    const found = findMath(child);
    if (found) return found;
  }
  return null;
}

/** Drops the TeX source annotation and the <semantics> wrapper around it. */
function clean(node: MNode): MNode {
  const children: MNode[] = [];
  for (const child of node.children) {
    if (child.tag === 'annotation' || child.tag === 'annotation-xml') continue;
    if (child.tag === 'semantics') {
      for (const inner of clean(child).children) children.push(inner);
      continue;
    }
    children.push(clean(child));
  }
  return { ...node, children };
}

// The same texts come round again (lists re-render, cards remount), and KaTeX
// is slow on a phone. Remember recent results, dropping the oldest past the limit.
const REMEMBERED = 2000;
const trees = new Map<string, MNode | null>();

/**
 * LaTeX to a MathML tree for drawing with native views. Null when KaTeX can't
 * parse it, so the caller can show the source instead.
 */
export function mathTree(latex: string, display: boolean): MNode | null {
  const key = (display ? 'D' : 'I') + latex;
  const known = trees.get(key);
  if (known !== undefined) return known;

  let tree: MNode | null = null;
  try {
    const markup = katex.renderToString(latex, {
      displayMode: display,
      output: 'mathml',
      throwOnError: true,
      strict: 'ignore',
    });
    const math = findMath(parseMarkup(markup));
    tree = math ? clean(math) : null;
  } catch {
    tree = null;
  }

  if (trees.size >= REMEMBERED) trees.delete(trees.keys().next().value!);
  trees.set(key, tree);
  return tree;
}
