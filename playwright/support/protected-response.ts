type ResponseContent = { body: Buffer; headers: Record<string, string> };

export function assertNoBypassReflection(response: ResponseContent, bypass: string) {
  if (!bypass || response.body.includes(Buffer.from(bypass))
    || Object.entries(response.headers).some(([name, value]) => name.includes(bypass) || value.includes(bypass))) {
    throw new Error('Protected response reflected a secret or the guard key is missing; content and headers omitted.');
  }
}

const responseHeaders = new Set([
  'content-type', 'cache-control', 'etag', 'last-modified', 'vary',
  'content-security-policy', 'content-security-policy-report-only',
  'cross-origin-opener-policy', 'cross-origin-resource-policy', 'cross-origin-embedder-policy',
  'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security',
  'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers',
  'access-control-allow-credentials', 'access-control-expose-headers', 'access-control-max-age',
]);

// Inspect the complete original headers before discarding cookies/private headers.
// This detects literal reflection only, not every possible encoding/transformation.
export function protectResponse<T extends ResponseContent>(response: T, bypass?: string): T {
  if (bypass !== undefined) assertNoBypassReflection(response, bypass);
  return { ...response, headers: Object.fromEntries(Object.entries(response.headers)
    .map(([name, value]) => [name.toLowerCase(), value])
    .filter(([name]) => responseHeaders.has(name))) };
}
