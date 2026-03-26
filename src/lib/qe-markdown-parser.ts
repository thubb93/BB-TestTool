/**
 * QE Markdown Test Case Parser — TypeScript port of qe-viewer/markdown-parser.js
 * Parses markdown files with H2 module sections and pipe-delimited tables.
 */

export interface TestCase {
  id: string;
  title: string;
  priority: string;
  preconditions: string;
  steps: string;
  expected: string;
  testData: string;
  tags: string;
  module: string;
}

export interface ParsedFile {
  title: string;
  feature: string;
  modules: Array<{ name: string; cases: TestCase[] }>;
}

// Map header text → field key
const HEADER_PATTERNS: Array<{ key: keyof Omit<TestCase, 'module'>; match: RegExp }> = [
  { key: 'id',            match: /^id$/i },
  { key: 'title',         match: /title/i },
  { key: 'priority',      match: /priority/i },
  { key: 'preconditions', match: /precondition/i },
  { key: 'steps',         match: /step/i },
  { key: 'expected',      match: /expected/i },
  { key: 'testData',      match: /test\s*data|data/i },
  { key: 'tags',          match: /tag/i },
];

function detectColumnMap(headerCells: string[]): Partial<Record<keyof Omit<TestCase, 'module'>, number>> {
  const map: Partial<Record<keyof Omit<TestCase, 'module'>, number>> = {};
  headerCells.forEach((cell, idx) => {
    const h = cell.trim();
    for (const { key, match } of HEADER_PATTERNS) {
      if (match.test(h) && !(key in map)) { map[key] = idx; break; }
    }
  });
  return map;
}

function splitRow(line: string): string[] {
  return line.slice(1, -1).split('|').map(c => c.trim());
}

function isSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.length > 2;
}

function getCell(cells: string[], map: Partial<Record<string, number>>, key: string, fallback?: number): string {
  const idx = key in map ? map[key]! : fallback;
  return (idx !== undefined && idx < cells.length) ? cells[idx] : '';
}

export function parseTestCases(content: string): ParsedFile {
  const lines = content.split('\n');
  const modules: ParsedFile['modules'] = [];
  let currentModule: { name: string; cases: TestCase[] } | null = null;
  let columnMap: Partial<Record<string, number>> = {};
  let inTable = false;
  let headerParsed = false;

  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : '';
  const featureLine = lines.find(l => /\*\*Feature:\*\*/.test(l));
  const feature = featureLine ? featureLine.replace(/.*\*\*Feature:\*\*\s*/, '').trim() : '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+/.test(trimmed) && !/^##\s+Summary/i.test(trimmed)) {
      currentModule = { name: trimmed.replace(/^##\s+(Module:\s*)?/, '').trim(), cases: [] };
      modules.push(currentModule);
      inTable = false; headerParsed = false; columnMap = {};
      continue;
    }

    if (!currentModule) continue;
    if (isSeparator(trimmed)) continue;

    if (isTableRow(trimmed)) {
      const cells = splitRow(trimmed);
      if (!headerParsed) {
        columnMap = detectColumnMap(cells);
        headerParsed = true; inTable = true;
        continue;
      }
      if (!inTable) continue;
      const id = getCell(cells, columnMap, 'id', 0);
      if (!id || /^id$/i.test(id) || id === '---') continue;
      currentModule.cases.push({
        id,
        title:         getCell(cells, columnMap, 'title', 1),
        priority:      getCell(cells, columnMap, 'priority', 2),
        preconditions: getCell(cells, columnMap, 'preconditions', 3),
        steps:         getCell(cells, columnMap, 'steps', 4),
        expected:      getCell(cells, columnMap, 'expected', 5),
        testData:      getCell(cells, columnMap, 'testData', 6),
        tags:          getCell(cells, columnMap, 'tags', 7),
        module:        currentModule.name,
      });
    } else if (inTable && trimmed === '') {
      inTable = false;
    }
  }

  return { title, feature, modules };
}
