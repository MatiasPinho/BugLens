export interface GoogleDocsAuthReader {
  isAuthenticated(): boolean
  getAuthUrl(): string
  waitForCallback(): Promise<void>
  revokeAuth(): Promise<void>
}

export interface BrowserDocsAuthReader {
  isAuthenticated(): boolean
  startLoginFlow(): Promise<void>
  revokeSession(): void
}

export interface AuthStatus {
  authenticated: boolean
}

export interface AuthActionResult {
  ok: boolean
  error?: string
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function getGoogleDocsAuthStatus(
  reader: Pick<GoogleDocsAuthReader, 'isAuthenticated'>,
): AuthStatus {
  return { authenticated: reader.isAuthenticated() }
}

export async function startGoogleDocsAuth(
  reader: Pick<GoogleDocsAuthReader, 'getAuthUrl' | 'waitForCallback'>,
  opener: { openExternal(url: string): Promise<void> },
): Promise<AuthActionResult> {
  await opener.openExternal(reader.getAuthUrl())
  try {
    await reader.waitForCallback()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function revokeGoogleDocsAuth(
  reader: Pick<GoogleDocsAuthReader, 'revokeAuth'>,
): Promise<AuthActionResult> {
  await reader.revokeAuth()
  return { ok: true }
}

export function getBrowserDocsAuthStatus(
  reader: Pick<BrowserDocsAuthReader, 'isAuthenticated'>,
): AuthStatus {
  return { authenticated: reader.isAuthenticated() }
}

export async function startBrowserDocsLogin(
  reader: Pick<BrowserDocsAuthReader, 'startLoginFlow'>,
): Promise<AuthActionResult> {
  try {
    await reader.startLoginFlow()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export function revokeBrowserDocsAuth(
  reader: Pick<BrowserDocsAuthReader, 'revokeSession'>,
): AuthActionResult {
  reader.revokeSession()
  return { ok: true }
}
