/**
 * Minimal, allocation-light tokenizer for read-only code viewing. It is not a
 * full parser; it colours keywords, strings, comments and numbers well enough
 * to read code on a phone without blocking the JS thread on 5k-line files.
 * Block-comment state carries across lines.
 */
export type TokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'tag' | 'type';
export type Token = { kind: TokenKind; text: string };

const KEYWORDS = new Set(
  (
    'import export from default const let var function return if else for while do switch case break continue new ' +
    'class extends super this typeof instanceof in of async await try catch finally throw yield interface type enum ' +
    'implements public private protected readonly static as satisfies null undefined true false void delete ' +
    'def elif lambda pass None True False with self not and or is select where insert update create table'
  ).split(' '),
);

const HASH_COMMENT = new Set(['python', 'shell', 'yaml']);

export function tokenizeLines(code: string, language: string): Token[][] {
  const lines = code.split('\n');
  const out: Token[][] = new Array(lines.length);
  let inBlock = false;
  const hash = HASH_COMMENT.has(language);
  const plainText = language === 'text' || language === 'markdown';

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] ?? '';
    const tokens: Token[] = [];
    if (plainText) {
      out[li] = [{ kind: 'plain', text: line }];
      continue;
    }
    let i = 0;
    let plain = '';
    const flush = () => {
      if (plain) {
        tokens.push({ kind: 'plain', text: plain });
        plain = '';
      }
    };
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) {
          tokens.push({ kind: 'comment', text: line.slice(i) });
          i = line.length;
        } else {
          tokens.push({ kind: 'comment', text: line.slice(i, end + 2) });
          i = end + 2;
          inBlock = false;
        }
        continue;
      }
      const ch = line[i] as string;
      const next = line[i + 1];
      if ((ch === '/' && next === '/' && !hash) || (ch === '#' && hash)) {
        flush();
        tokens.push({ kind: 'comment', text: line.slice(i) });
        break;
      }
      if (ch === '/' && next === '*') {
        flush();
        inBlock = true;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        flush();
        let j = i + 1;
        while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
        tokens.push({ kind: 'string', text: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      if (/[0-9]/.test(ch) && !/[A-Za-z_$]/.test(line[i - 1] ?? '')) {
        flush();
        let j = i;
        while (j < line.length && /[0-9._xa-fA-F]/.test(line[j] as string)) j++;
        tokens.push({ kind: 'number', text: line.slice(i, j) });
        i = j;
        continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i;
        while (j < line.length && /[A-Za-z0-9_$]/.test(line[j] as string)) j++;
        const word = line.slice(i, j);
        if (KEYWORDS.has(word)) {
          flush();
          tokens.push({ kind: 'keyword', text: word });
        } else if (/^[A-Z]/.test(word) && line[i - 1] !== '.') {
          flush();
          tokens.push({ kind: line[i - 1] === '<' ? 'tag' : 'type', text: word });
        } else {
          plain += word;
        }
        i = j;
        continue;
      }
      plain += ch;
      i++;
    }
    flush();
    out[li] = tokens;
  }
  return out;
}
