/*
 * The deployment's runtime configuration (ADR 0047, decision 1): `/config.json` next to the page, read once
 * per page load before the first request to the API, so that one build of the web (the image, the desktop
 * app) serves any deployment. Every key is optional; a file that is missing, unreadable or wrong is the web
 * on the edge's own origin, as before:
 *
 *   apiOrigin     where the API is, `https://chat.example.com` (the desktop and mobile apps, whose own
 *                 origin is `tauri://localhost`). Absent: the page's own origin.
 *   clientId      the public OAuth client this build signs in as (`another-agentic-desktop`), in place of the
 *                 one `GET /api/public/auth` names (the browser web's). The issuer and the scope stay the
 *                 orchestrator's: its tokens are what it verifies.
 *   signIn        `redirect` (the browser: a full-page redirect and back to `/auth/callback`), `loopback`
 *                 (the desktop app: the system browser and a listener on 127.0.0.1, RFC 8252), or
 *                 `claimed` (the mobile app: an app/universal HTTPS link received from the native shell).
 *   organisation  the name the sign-in screen gives the account ("Sign in with your … account").
 *   boardOrigin   where factory-board is, `https://board.example.com` (a separate edge). Absent: the
 *                 same-origin `/board/*` routes of the factory Caddy, which strip the prefix before
 *                 proxying to factory-board (ADR 0073). It is an origin, never a path with a prefix.
 */

export type SignInMode = "redirect" | "loopback" | "claimed";

export type RuntimeConfig = {
  apiOrigin?: string;
  clientId?: string;
  signIn?: SignInMode;
  organisation?: string;
  boardOrigin?: string;
};

export const RUNTIME_CONFIG_PATH = "/config.json";

const isLoopbackHost = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);

/** An origin the page may send a request to: https, or http on this machine (a local run). */
export function isConfiguredOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      value === url.origin &&
      (url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname)))
    );
  } catch {
    return false;
  }
}

/** The old name of {@link isConfiguredOrigin}, kept for callers that speak about the API. */
export const isApiOrigin = isConfiguredOrigin;

const isClientId = (value: unknown): value is string =>
  typeof value === "string" && /^[\x21-\x7e]{1,200}$/.test(value);

/** The keys of a parsed file that are right; the others are dropped. */
export function parseRuntimeConfig(body: unknown): RuntimeConfig {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return {};
  const { apiOrigin, clientId, signIn, organisation, boardOrigin } = body as Record<
    string,
    unknown
  >;
  return {
    ...(isApiOrigin(apiOrigin) ? { apiOrigin } : {}),
    ...(isClientId(clientId) ? { clientId } : {}),
    ...(signIn === "redirect" || signIn === "loopback" || signIn === "claimed" ? { signIn } : {}),
    ...(typeof organisation === "string" && organisation.trim() && organisation.length <= 120
      ? { organisation: organisation.trim() }
      : {}),
    ...(isApiOrigin(boardOrigin) ? { boardOrigin } : {}),
  };
}

let known: RuntimeConfig | undefined;
let asking: Promise<RuntimeConfig> | undefined;

async function load(): Promise<RuntimeConfig> {
  try {
    const res = await globalThis.fetch(RUNTIME_CONFIG_PATH, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    known = res.ok ? parseRuntimeConfig(await res.json()) : {};
  } catch {
    known = {};
  }
  return known;
}

/** The configuration, once it is in: every request to the API waits for the same single read. */
export function runtimeReady(): Promise<RuntimeConfig> {
  if (known !== undefined) return Promise.resolve(known);
  asking ??= load();
  return asking;
}

/** The configuration if it has been read, else the defaults. */
export const runtimeConfig = (): RuntimeConfig => known ?? {};

const pageOrigin = (): string | undefined =>
  typeof window === "undefined" ? undefined : window.location.origin;

/** The origin the API is at: the configured one, else the page's own. */
export const apiOrigin = (): string | undefined => runtimeConfig().apiOrigin ?? pageOrigin();

/** The origin factory-board is at when configured separately (`boardOrigin`), else the page's own. */
export const boardOrigin = (): string | undefined => runtimeConfig().boardOrigin ?? pageOrigin();

/**
 * The basePath for `FactoryBoardSdkClient` (`""` when `boardOrigin` is configured directly since
 * factory-board mounts routes at `/`, else `"/board"` for same-origin Caddy `handle_path /board/*`).
 */
export const boardBasePath = (): string => (runtimeConfig().boardOrigin ? "" : "/board");

/** The API's routes: the resource API and AG-UI. */
export const isApiPath = (pathname: string): boolean =>
  pathname.startsWith("/api/") || pathname.startsWith("/agui/");

/** factory-board's routes at this page's origin (the factory Caddy strips `/board` before proxying). */
export const isBoardPath = (pathname: string): boolean =>
  pathname === "/board" || pathname.startsWith("/board/");

/** Whether a request the clients made with a path of this page goes to another origin (`atApi`). */
function elsewhere(request: Request): string | undefined {
  const { apiOrigin: api, boardOrigin: board } = runtimeConfig();
  const here = pageOrigin();
  if ((!api || api === here) && (!board || board === here)) return undefined;
  try {
    const url = new URL(request.url);
    if (url.origin !== here) return undefined;
    if (api && api !== here && isApiPath(url.pathname)) {
      return `${api}${url.pathname}${url.search}`;
    }
    // factory-board mounts its routes at `/`, not under `/board`: the Caddy's `handle_path /board/*`
    // strips the prefix on the same-origin route, and the direct origin must do the same.
    if (board && board !== here && isBoardPath(url.pathname)) {
      return `${board}${url.pathname.slice("/board".length)}${url.search}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * A request the clients made with a path of this page (`/api/...`, `/agui/...`, `/board/...`), sent to
 * the API's or factory-board's origin when that is another one; any other request as it is. The body is
 * read and sent again (a request whose body is a stream cannot be given a new URL without it), and so
 * are the headers and the signal.
 */
export async function atApi(request: Request): Promise<Request> {
  await runtimeReady();
  const target = elsewhere(request);
  if (!target) return request;
  const body = request.body ? await request.arrayBuffer() : undefined;
  return new Request(target, {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    cache: request.cache,
    redirect: request.redirect,
    credentials: "omit",
    ...(body === undefined ? {} : { body }),
  });
}

/** The URL of an API path, at the API's origin (`/api/public/auth`, a file's `href`). */
export function apiUrl(path: string): string {
  const configured = runtimeConfig().apiOrigin;
  return configured && path.startsWith("/") ? `${configured}${path}` : path;
}

/**
 * The URL of a factory-board path. Configured: at `boardOrigin`, whose routes are mounted at `/`.
 * Otherwise: this page's own `/board/...`, which the factory Caddy strips before proxying.
 */
export function boardUrl(path: string): string {
  const configured = runtimeConfig().boardOrigin;
  if (!path.startsWith("/")) return path;
  return configured ? `${configured}${path}` : `/board${path}`;
}

/** Fixes the configuration (a test): `undefined` reads the file again. */
export function setRuntimeConfig(config: RuntimeConfig | undefined) {
  known = config;
  asking = undefined;
}
