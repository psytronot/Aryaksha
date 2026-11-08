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
  if (/^(inline|eval|wasm-eval|self)$/i.test(input)) return input;

  try {
    const url = new URL(input, 'https://local.invalid');
    if (url.origin === 'https://local.invalid') {
      return url.pathname.slice(0, MAX_URI_LENGTH);
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `${url.origin}${url.pathname}`.slice(0, MAX_URI_LENGTH);
    }
    // Non-web schemes can embed document contents, local paths or opaque IDs.
    // Keep only the scheme so report logging cannot leak those payloads.
    return url.protocol.slice(0, MAX_URI_LENGTH);
  } catch {
    // Do not echo malformed URI text: it may contain arbitrary sensitive data.
    return 'unparseable:';
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
