// Lightweight helpers to call services through the backend proxy (avoids CORS).

export interface ProxyResponse<T = unknown> {
  status:     number
  data:       T
  setCookie?: string
}

async function callProxy<T>(body: object): Promise<ProxyResponse<T>> {
  const res  = await fetch('/api/proxy', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const json = await res.json() as { error?: string } & ProxyResponse<T>
  if (json.error)        throw new Error(json.error)
  if (json.status >= 400) throw new Error(`HTTP ${json.status}`)
  return json
}

/** GET a URL through the proxy, returning the parsed response body. */
export async function proxyGet<T = unknown>(
  url:     string,
  headers: Record<string, string> = {},
): Promise<T> {
  return (await callProxy<T>({ url, headers })).data
}

/** POST through the proxy, returning the full ProxyResponse (includes setCookie). */
export async function proxyPost<T = unknown>(
  url:     string,
  body:    string,
  headers: Record<string, string> = {},
): Promise<ProxyResponse<T>> {
  return callProxy<T>({ url, method: 'POST', body, headers })
}

/** Convenience helper shared by Sonarr / Radarr / Lidarr *arr-stack. */
export async function arrGet<T = unknown>(
  baseUrl: string,
  apiKey:  string,
  path:    string,
): Promise<T> {
  return proxyGet<T>(
    `${baseUrl.replace(/\/$/, '')}${path}`,
    { 'X-Api-Key': apiKey },
  )
}
