import { describe, expect, test } from 'vitest';
import { parseBusinessCsv, serializeBusinessCsv } from '../src/businessCsv';

describe('parseBusinessCsv', () => {
  test('handles a UTF-8 BOM, quoted commas and escaped quotes', () => {
    const result = parseBusinessCsv('\uFEFFCompany,Website,City\n"Acme, Robotics",https://acme.example,Bengaluru\n"Quote ""Lab""",,Pune');
    expect(result.total).toBe(2);
    expect(result.records).toEqual([
      { company: 'Acme, Robotics', website: 'https://acme.example', city: 'Bengaluru' },
      { company: 'Quote "Lab"', website: '', city: 'Pune' }
    ]);
  });

  test('supports line breaks inside a quoted field', () => {
    const result = parseBusinessCsv('Company,Website,City\n"Acme\nRobotics",https://acme.example,Bengaluru');
    expect(result.records[0].company).toBe('Acme\nRobotics');
  });

  test('handles Windows CRLF rows and ignores blank lines', () => {
    const result = parseBusinessCsv('Company,Website\r\nAcme,https://acme.example\r\n\r\nOrbit,https://orbit.example\r\n');
    expect(result.total).toBe(2);
    expect(result.records.map(record => record.company)).toEqual(['Acme', 'Orbit']);
  });

  test('removes duplicate company and website pairs case-insensitively', () => {
    const result = parseBusinessCsv('Company,Website,City\nAcme Robotics,https://acme.example/,Bengaluru\nACME ROBOTICS,https://ACME.EXAMPLE/,Pune');
    expect(result.records).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  test('rejects quotes embedded in unquoted fields', () => {
    expect(() => parseBusinessCsv('Company,Website\nAcme "Robotics",https://acme.example'))
      .toThrow('A quoted field must start with a quote');
  });

  test('rejects characters after a closing quote', () => {
    expect(() => parseBusinessCsv('Company,Website\n"Acme" Robotics,https://acme.example'))
      .toThrow('Unexpected characters after a closing quote');
  });

  test('rejects unclosed quoted fields', () => {
    expect(() => parseBusinessCsv('Company,Website\n"Acme Robotics,https://acme.example'))
      .toThrow('unclosed quoted field');
  });

  test('rejects duplicate headers and inconsistent row widths', () => {
    expect(() => parseBusinessCsv('Company,company\nAcme,Acme')).toThrow('duplicate column names');
    expect(() => parseBusinessCsv('Company,Website,City\nAcme,https://acme.example')).toThrow('same number of columns');
  });

  test('requires a recognised organisation column and at least one data row', () => {
    expect(() => parseBusinessCsv('Website,City\nhttps://example.test,Bengaluru')).toThrow('Company, Business Name or Name');
    expect(() => parseBusinessCsv('Company,Website')).toThrow('at least one organisation');
  });

  test('enforces row, column and cell limits', () => {
    const tooManyRows = 'Company\n' + Array.from({ length: 10_001 }, (_, index) => `Company ${index}`).join('\n');
    expect(() => parseBusinessCsv(tooManyRows)).toThrow('no more than 10,000 data rows');

    const tooManyColumns = Array.from({ length: 51 }, (_, index) => `Field ${index}`).join(',');
    expect(() => parseBusinessCsv(`Company,${tooManyColumns}\nAcme,${Array(51).fill('value').join(',')}`))
      .toThrow('no more than 50 columns');

    expect(() => parseBusinessCsv('Company\n' + 'A'.repeat(4_097)))
      .toThrow('cell cannot exceed 4,096 characters');
  });
  test('serializes CSV with CRLF, escaping and formula-prefix neutralization', () => {
    const output = serializeBusinessCsv([
      { company: '=HYPERLINK("https://bad.example")', website: '@external', city: ' +Bengaluru' },
      { company: 'Acme, "Robotics"', website: 'https://acme.example', city: 'Pune' }
    ]);
    expect(output.startsWith('"Company","Website","City"\\r\\n')).toBe(true);
    expect(output).toContain("'=HYPERLINK(\"\"https://bad.example\"\")");
    expect(output).toContain("'@external");
    expect(output).toContain("' +Bengaluru");
    expect(output).toContain('Acme, ""Robotics""');
  });
});
