export interface ParsedCurl {
  method: string;
  baseUrl: string;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: string;
}

/** Tokenize a shell-like string, preserving single/double quoted groups */
function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < cmd.length) {
    // skip whitespace
    if (/\s/.test(cmd[i])) { i++; continue; }

    // single-quoted
    if (cmd[i] === "'") {
      i++;
      let str = "";
      while (i < cmd.length && cmd[i] !== "'") str += cmd[i++];
      i++; // closing quote
      tokens.push(str);
      continue;
    }

    // double-quoted
    if (cmd[i] === '"') {
      i++;
      let str = "";
      while (i < cmd.length && cmd[i] !== '"') {
        if (cmd[i] === "\\" && i + 1 < cmd.length) { str += cmd[++i]; }
        else { str += cmd[i]; }
        i++;
      }
      i++; // closing quote
      tokens.push(str);
      continue;
    }

    // unquoted token
    let token = "";
    while (i < cmd.length && !/\s/.test(cmd[i])) token += cmd[i++];
    if (token) tokens.push(token);
  }

  return tokens;
}

export function parseCurl(curlCommand: string): ParsedCurl {
  const result: ParsedCurl = {
    method: "GET",
    baseUrl: "",
    params: {},
    headers: {},
    body: "",
  };

  // Normalize line continuations
  const normalized = curlCommand
    .replace(/\\\s*\r?\n\s*/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = tokenize(normalized);
  let i = 0;
  let hasExplicitMethod = false;

  while (i < tokens.length) {
    const t = tokens[i];

    if (t === "curl" || t === "--location" || t === "-L" || t === "--silent" || t === "-s" || t === "--compressed") {
      i++;
      continue;
    }

    if (t === "--request" || t === "-X") {
      i++;
      if (i < tokens.length) { result.method = tokens[i].toUpperCase(); hasExplicitMethod = true; }

    } else if (t === "--header" || t === "-H") {
      i++;
      if (i < tokens.length) {
        const header = tokens[i];
        const colonIdx = header.indexOf(":");
        if (colonIdx > 0) {
          const key = header.slice(0, colonIdx).trim();
          const value = header.slice(colonIdx + 1).trim();
          result.headers[key] = value;
        }
      }

    } else if (t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "-d") {
      i++;
      if (i < tokens.length) {
        result.body = tokens[i];
        if (!hasExplicitMethod) result.method = "POST";
      }

    } else if (t === "--url") {
      i++;
      if (i < tokens.length) parseUrl(tokens[i], result);

    } else if (!t.startsWith("-")) {
      // Bare URL
      if (!result.baseUrl && (t.startsWith("http://") || t.startsWith("https://"))) {
        parseUrl(t, result);
      }
    }

    i++;
  }

  return result;
}

function parseUrl(raw: string, result: ParsedCurl) {
  try {
    const url = new URL(raw);
    result.baseUrl = `${url.origin}${url.pathname}`;
    url.searchParams.forEach((val, key) => {
      result.params[key] = val;
    });
  } catch {
    // Fallback: split on '?'
    const [base, qs] = raw.split("?");
    result.baseUrl = base;
    if (qs) {
      qs.split("&").forEach((pair) => {
        const [k, v = ""] = pair.split("=");
        if (k) result.params[decodeURIComponent(k)] = decodeURIComponent(v);
      });
    }
  }
}
