const MAX_REPORTS = 10;
const MAX_TEXT_LENGTH = 160;
const MAX_URI_LENGTH = 240;

function boundedText(value) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, MAX_TEXT_LENGTH) : undefined;
}

function safeUri(value) {
  if (typeof value !== 'string') return undefined;
  const input = value.trim();
  if (!input) return undefined;
  if (/^(inline|eval|wasm-eval|self|data|blob)$/i.test(input)) return input;

  try {
    const url = new URL(input, 'https://local.invalid');
    const normalized = url.origin === 'https://local.invalid'
      ? url.pathname
      : `${url.origin}${url.pathname}`;
    return normalized.slice(0, MAX_URI_LENGTH);
  } catch {
    return input.slice(0, MAX_URI_LENGTH);
  }
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const source = entry['csp-report'] ?? entry.body ?? entry;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;

  const violatedDirective = boundedText(source['violated-directive'] ?? source.violatedDirective);
  const effectiveDirective = boundedText(source['effective-directive'] ?? source.effectiveDirective);
  if (!violatedDirective && !effectiveDirective) return null;

  const statusCode = source['status-code'] ?? source.statusCode;
  const lineNumber = source['line-number'] ?? source.lineNumber;
  const columnNumber = source['column-number'] ?? source.columnNumber;

  return Object.fromEntries(Object.entries({
    type: 'csp-violation',
    disposition: boundedText(source.disposition) ?? 'report',
    effectiveDirective,
    violatedDirective,
    blockedUri: safeUri(source['blocked-uri'] ?? source.blockedURL ?? source.blockedUri),
    documentUri: safeUri(source['document-uri'] ?? source.documentURL ?? source.documentUri),
    sourceFile: safeUri(source['source-file'] ?? source.sourceFile),
    statusCode: Number.isInteger(statusCode) ? statusCode : undefined,
    lineNumber: Number.isInteger(lineNumber) ? lineNumber : undefined,
    columnNumber: Number.isInteger(columnNumber) ? columnNumber : undefined
  }).filter(([, value]) => value !== undefined));
}

export function normalizeCspReports(payload) {
  const entries = Array.isArray(payload) ? payload : [payload];
  if (entries.length === 0 || entries.length > MAX_REPORTS) return null;

  const reports = entries.map(normalizeEntry);
  return reports.every(Boolean) ? reports : null;
}
