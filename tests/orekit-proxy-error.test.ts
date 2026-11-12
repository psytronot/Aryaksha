import { describe, expect, it } from 'vitest';
import { mapOrekitProxyException, mapOrekitProxyFailure } from '../backend/orekitProxyError';

describe('Orekit proxy failure mapping', () => {
  it('preserves the structured HTTP 400 periapsis validation response', () => {
    expect(mapOrekitProxyFailure(400, {
      error: 'The selected orbit intersects Earth at periapsis.'
    })).toEqual({
      status: 400,
      message: 'The selected orbit intersects Earth at periapsis.'
    });
  });

  it('uses a stable validation message when an HTTP 400 body is not structured', () => {
    expect(mapOrekitProxyFailure(400, 'Bad Request')).toEqual({
      status: 400,
      message: 'Orekit rejected the orbit-analysis request.'
    });
  });

  it('maps upstream server failures to HTTP 502 without forwarding internal details', () => {
    expect(mapOrekitProxyFailure(503, {
      error: 'internal host and stack trace'
    })).toEqual({
      status: 502,
      message: 'Orekit service returned HTTP 503.'
    });
  });

  it('does not misreport unexpected upstream client errors as user validation failures', () => {
    expect(mapOrekitProxyFailure(404, {
      error: 'route not found'
    })).toEqual({
      status: 502,
      message: 'Orekit service returned HTTP 404.'
    });
  });

  it('bounds the forwarded controlled validation message', () => {
    const result = mapOrekitProxyFailure(400, { error: 'x'.repeat(500) });
    expect(result.status).toBe(400);
    expect(result.message).toHaveLength(300);
  });
  
  it('returns a retryable 503 when the Orekit readiness request times out', () => {
    const timeout = new Error('The operation was aborted.');
    timeout.name = 'AbortError';
    expect(mapOrekitProxyException(timeout)).toEqual({
      status: 503,
      message: 'Orekit did not become ready within 15 seconds. The service may be waking from idle; retry after 60 seconds.'
    });
  });

  it('keeps non-timeout transport failures as HTTP 502', () => {
    expect(mapOrekitProxyException(new TypeError('fetch failed'))).toEqual({
      status: 502,
      message: 'Orekit service is configured but unavailable. Check its deployment and logs.'
    });
  });

});
