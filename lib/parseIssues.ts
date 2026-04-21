export type Issue = {
  line: number;
  issue: string;
  fix_suggestion: string;
};

/** Try hard to extract a JSON array from an incremental stream buffer.
 * Handles: leading prose, ```json fences, trailing commas, truncated tails.
 * Returns the longest prefix of issues that parse cleanly, or [] if nothing yet.
 */
export function parseIssuesLoose(buf: string): Issue[] {
  if (!buf) return [];

  // Strip ``` fences if present.
  let s = buf.replace(/```(?:json)?/gi, "").replace(/```/g, "");

  // Find the first '['.
  const start = s.indexOf("[");
  if (start === -1) return [];
  s = s.slice(start);

  // First, try to parse as-is.
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return coerce(v);
  } catch {
    // continue
  }

  // Walk the string finding balanced object chunks inside the array.
  const issues: Issue[] = [];
  let i = 1; // skip '['
  while (i < s.length) {
    // skip whitespace and commas
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "]") break;
    if (s[i] !== "{") break;

    // find matching '}'
    let depth = 0;
    let j = i;
    let inStr = false;
    let esc = false;
    for (; j < s.length; j++) {
      const c = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) break; // truncated object, stop.

    const chunk = s.slice(i, j);
    try {
      const obj = JSON.parse(chunk);
      const c = coerceOne(obj);
      if (c) issues.push(c);
    } catch {
      // skip this one
    }
    i = j;
  }
  return issues;
}

function coerce(arr: unknown[]): Issue[] {
  const out: Issue[] = [];
  for (const x of arr) {
    const c = coerceOne(x);
    if (c) out.push(c);
  }
  return out;
}

function coerceOne(x: unknown): Issue | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const line = Number(o.line);
  const issue = typeof o.issue === "string" ? o.issue : "";
  const fix = typeof o.fix_suggestion === "string" ? o.fix_suggestion : "";
  if (!Number.isFinite(line) || line < 1) return null;
  if (!issue) return null;
  return { line: Math.floor(line), issue, fix_suggestion: fix };
}
