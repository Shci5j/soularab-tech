export function cleanApiBase(value) {
  let result = String(value ?? '').trim();
  while (result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

export function safeApiBase(value) {
  const base = cleanApiBase(value);
  if (!base) return '';
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error('Invalid backend URL. Use an HTTPS origin or a local loopback address.');
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const localHttp = parsed.protocol === 'http:' && loopbackHosts.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localHttp) {
    throw new Error('Backend URLs must use HTTPS. HTTP is allowed only for localhost development.');
  }
  if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '' && parsed.pathname !== '/')) {
    throw new Error('Backend URL must be a plain origin without credentials, paths, queries, or fragments.');
  }
  return parsed.origin;
}
