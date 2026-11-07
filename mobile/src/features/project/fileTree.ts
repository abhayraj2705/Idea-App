import type { ProjectFile } from '@/api/types';

export type TreeRow = { kind: 'dir' | 'file'; path: string; name: string; depth: number; size?: number };

/** Flattens files into visible tree rows given the set of expanded folders. Folders first, alphabetical. */
export function buildTreeRows(files: Pick<ProjectFile, 'path' | 'size'>[], expanded: Set<string>): TreeRow[] {
  type Node = { dirs: Map<string, Node>; files: { name: string; path: string; size?: number }[] };
  const root: Node = { dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.replace(/^\/+/, '').split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part)!;
    }
    node.files.push({ name: parts[parts.length - 1]!, path: f.path, size: f.size });
  }
  const rows: TreeRow[] = [];
  const walk = (node: Node, prefix: string, depth: number) => {
    for (const [name, child] of [...node.dirs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const path = prefix ? `${prefix}/${name}` : name;
      rows.push({ kind: 'dir', path, name, depth });
      if (expanded.has(path)) walk(child, path, depth + 1);
    }
    for (const f of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
      rows.push({ kind: 'file', path: f.path, name: f.name, depth, size: f.size });
    }
  };
  walk(root, '', 0);
  return rows;
}

/** Subsequence fuzzy match with a simple score (lower is better). Returns null when no match. */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;
  const direct = t.indexOf(q);
  if (direct >= 0) return direct - (t.endsWith(q) ? 50 : 0);
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    gaps += found - ti;
    ti = found + 1;
  }
  return 100 + gaps;
}
