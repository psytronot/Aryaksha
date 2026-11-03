export type OrekitProxyFailure = Readonly<{
  status: number;
  message: string;
}>;

function upstreamValidationMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const candidate = typeof record.error === 'string'
    ? record.error
    : typeof record.message === 'string'
      ? record.message
      : undefined;
  const message = candidate?.trim();
  return message ? message.slice(0, 300) : undefined;
}

/**
 * Preserve a controlled upstream validation rejection as a client error.
 * Transport, gateway, authentication and server failures remain proxy 502s.
 */
export function mapOrekitProxyFailure(status: number, payload: unknown): OrekitProxyFailure {
  if (status === 400) {
    return {
      status: 400,
      message: upstreamValidationMessage(payload) ?? 'Orekit rejected the orbit-analysis request.'
    };
  }

  return {
    status: 502,
    message: `Orekit service returned HTTP ${status}.`
  };
}
