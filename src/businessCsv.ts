export interface BusinessCsvRecord {
  company: string;
  website: string;
  city: string;
}

export interface BusinessCsvResult {
  total: number;
  records: BusinessCsvRecord[];
  duplicates: number;
}

const MAX_DATA_ROWS = 10_000;
const MAX_COLUMNS = 50;
const MAX_CELL_LENGTH = 4_096;

/**
 * Parse a bounded, user-supplied business CSV. This function performs no
 * network access and deliberately rejects ambiguous CSV quoting/row shapes.
 */
export function parseBusinessCsv(raw: string): BusinessCsvResult {
  raw = raw.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (char === '"' && quoted && raw[i + 1] === '"') {
      field += '"';
      i += 1;
    } else if (char === '"' && quoted) {
      quoted = false;
      closedQuote = true;
    } else if (char === '"' && !quoted && field.length === 0 && !closedQuote) {
      quoted = true;
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
      closedQuote = false;
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && raw[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = '';
      closedQuote = false;
    } else {
      if (closedQuote) throw new Error('Unexpected characters after a closing quote.');
      if (char === '"' && !quoted) throw new Error('A quoted field must start with a quote at the beginning of the field.');
      field += char;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('Add a header row and at least one organisation.');
  if (rows.length > MAX_DATA_ROWS + 1) throw new Error('A CSV may contain no more than 10,000 data rows.');

  const headers = rows[0].map(value => value.trim().toLowerCase());
  if (headers.length > MAX_COLUMNS) throw new Error('A CSV may contain no more than 50 columns.');
  if (rows.some(values => values.some(value => value.length > MAX_CELL_LENGTH))) {
    throw new Error('A CSV cell cannot exceed 4,096 characters.');
  }
  if (new Set(headers).size !== headers.length) throw new Error('The CSV contains duplicate column names.');
  if (rows.slice(1).some(values => values.length !== headers.length)) {
    throw new Error('Every CSV row must have the same number of columns as the header.');
  }

  const companyIndex = headers.findIndex(value => ['company', 'company name', 'business name', 'organisation', 'organization', 'name'].includes(value));
  const websiteIndex = headers.findIndex(value => ['website', 'site', 'url', 'company website'].includes(value));
  const cityIndex = headers.findIndex(value => ['city', 'location', 'region'].includes(value));
  if (companyIndex < 0) throw new Error('Add a Company, Business Name or Name column.');

  const seen = new Set<string>();
  const records: BusinessCsvRecord[] = [];
  let duplicates = 0;
  for (const values of rows.slice(1)) {
    const company = (values[companyIndex] || '').trim();
    if (!company) continue;
    const website = websiteIndex >= 0 ? (values[websiteIndex] || '').trim() : '';
    const city = cityIndex >= 0 ? (values[cityIndex] || '').trim() : '';
    const key = company.toLocaleLowerCase().replace(/\s+/g, ' ') + '|' + website.toLocaleLowerCase().replace(/\/$/, '');
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    records.push({ company, website, city });
  }
  return { total: rows.length - 1, records, duplicates };
}
