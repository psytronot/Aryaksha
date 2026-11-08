import { describe, expect, it } from 'vitest';
import { normalizeCspReports } from '../backend/csp-report.mjs';

describe('CSP report normalization', () => {
  it('accepts legacy reports and removes query strings, fragments and credentials', () => {
    const reports = normalizeCspReports({
      'csp-report': {
        'document-uri': 'https://aryaksha.example/app?session=private#section',
        'blocked-uri': 'https://tracker.example/pixel?token=private',
        'source-file': 'https://aryaksha.example/assets/app.js?cache=1',
        'violated-directive': 'img-src',
        'effective-directive': 'img-src',
        disposition: 'report',
        'status-code': 200
      }
    });

    expect(reports).toEqual([{
      type: 'csp-violation',
      disposition: 'report',
      effectiveDirective: 'img-src',
      violatedDirective: 'img-src',
      blockedUri: 'https://tracker.example/pixel',
      documentUri: 'https://aryaksha.example/app',
      sourceFile: 'https://aryaksha.example/assets/app.js',
      statusCode: 200
    }]);
  });

  it('accepts Reporting API arrays and camel-case fields', () => {
    const reports = normalizeCspReports([{
      type: 'csp-violation',
      body: {
        disposition: 'report',
        effectiveDirective: 'connect-src',
        violatedDirective: 'connect-src',
        blockedURL: 'https://telemetry.example/collect?secret=1',
        documentURL: 'https://aryaksha.example/',
        statusCode: 200,
        lineNumber: 12,
        columnNumber: 4
      }
    }]);

    expect(reports).toEqual([{
      type: 'csp-violation',
      disposition: 'report',
      effectiveDirective: 'connect-src',
      violatedDirective: 'connect-src',
      blockedUri: 'https://telemetry.example/collect',
      documentUri: 'https://aryaksha.example/',
      statusCode: 200,
      lineNumber: 12,
      columnNumber: 4
    }]);
  });

  it('redacts non-web URI payloads and keeps only their scheme', () => {
    const reports = normalizeCspReports({
      'csp-report': {
        'violated-directive': 'img-src',
        'blocked-uri': 'data:text/html,<script>private-data</script>',
        'document-uri': 'file:///private/home/user/report.html?token=secret',
        'source-file': 'javascript:alert("secret")'
      }
    });

    expect(reports).toEqual([{
      type: 'csp-violation',
      disposition: 'report',
      violatedDirective: 'img-src',
      blockedUri: 'data:',
      documentUri: 'file:',
      sourceFile: 'javascript:'
    }]);
  });

  it('redacts malformed URI text instead of logging it verbatim', () => {
    const reports = normalizeCspReports({
      'csp-report': {
        'violated-directive': 'img-src',
        'blocked-uri': 'https://[private malformed URI'
      }
    });

    expect(reports?.[0].blockedUri).toBe('unparseable:');
  });

  it('bounds report text and rejects malformed or excessive payloads', () => {
    const longDirective = 'img-src '.repeat(40);
    const bounded = normalizeCspReports({
      'csp-report': {
        'violated-directive': longDirective,
        'blocked-uri': 'inline'
      }
    });
    expect(bounded?.[0].violatedDirective).toHaveLength(160);
    expect(bounded?.[0].blockedUri).toBe('inline');

    expect(normalizeCspReports(null)).toBeNull();
    expect(normalizeCspReports({ 'csp-report': { 'blocked-uri': 'https://example.com' } })).toBeNull();
    expect(normalizeCspReports(Array.from({ length: 11 }, () => ({
      'csp-report': { 'violated-directive': 'img-src' }
    })))).toBeNull();
  });
});
