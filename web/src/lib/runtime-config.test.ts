import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiOrigin,
  apiUrl,
  atApi,
  boardBasePath,
  boardOrigin,
  boardUrl,
  isApiOrigin,
  isApiPath,
  isBoardPath,
  isConfiguredOrigin,
  parseRuntimeConfig,
  setRuntimeConfig,
} from "./runtime-config";

const page = "https://web.example";
const board = "https://board.example";

afterEach(() => {
  setRuntimeConfig(undefined);
  vi.unstubAllGlobals();
});

describe("the board keys of /config.json", () => {
  it("accepts an origin for boardOrigin, as for apiOrigin, and nothing with a path", () => {
    expect(isConfiguredOrigin(board)).toBe(true);
    expect(isConfiguredOrigin("http://127.0.0.1:8090")).toBe(true);
    expect(isConfiguredOrigin(`${board}/projects`)).toBe(false);
    expect(isConfiguredOrigin("http://board.example")).toBe(false);
    expect(isConfiguredOrigin(42)).toBe(false);
    expect(isApiOrigin).toBe(isConfiguredOrigin);
  });

  it("keeps a good boardOrigin and drops a bad one with the other keys", () => {
    expect(
      parseRuntimeConfig({
        boardOrigin: board,
        apiOrigin: "https://api.example",
        organisation: "  Acme  ",
        clientId: "another-agentic-desktop",
        signIn: "loopback",
      }),
    ).toEqual({
      boardOrigin: board,
      apiOrigin: "https://api.example",
      organisation: "Acme",
      clientId: "another-agentic-desktop",
      signIn: "loopback",
    });
    expect(parseRuntimeConfig({ boardOrigin: `${board}/board` })).toEqual({});
    expect(parseRuntimeConfig(null)).toEqual({});
  });
});

describe("board paths", () => {
  it("recognises the same-origin prefix and only the API's own routes", () => {
    expect(isBoardPath("/board")).toBe(true);
    expect(isBoardPath("/board/projects")).toBe(true);
    expect(isBoardPath("/projects")).toBe(false);
    expect(isApiPath("/agui/agents/adam-architect")).toBe(true);
    expect(isApiPath("/api/public/auth")).toBe(true);
    expect(isApiPath("/board/projects")).toBe(false);
  });

  it("uses the Caddy prefix by default and mounts at / on a separate board origin", () => {
    vi.stubGlobal("window", { location: { origin: page } });
    expect(boardOrigin()).toBe(page);
    expect(boardBasePath()).toBe("/board");
    expect(boardUrl("/projects")).toBe("/board/projects");

    setRuntimeConfig({ boardOrigin: board });
    expect(boardOrigin()).toBe(board);
    expect(boardBasePath()).toBe("");
    expect(boardUrl("/projects")).toBe(`${board}/projects`);
    expect(boardUrl("projects")).toBe("projects");
  });
});

describe("atApi", () => {
  it("sends API paths to the API and board paths to the board, stripping /board there", async () => {
    vi.stubGlobal("window", { location: { origin: page } });
    setRuntimeConfig({ apiOrigin: "https://api.example", boardOrigin: board });

    const api = await atApi(new Request(`${page}/api/public/auth?q=1`));
    expect(api.url).toBe("https://api.example/api/public/auth?q=1");

    const boardRequest = await atApi(
      new Request(`${page}/board/projects?x=2`, { method: "POST", body: "{}" }),
    );
    expect(boardRequest.url).toBe(`${board}/projects?x=2`);
    expect(await boardRequest.text()).toBe("{}");
  });

  it("leaves another origin and an ordinary page path alone", async () => {
    vi.stubGlobal("window", { location: { origin: page } });
    setRuntimeConfig({ boardOrigin: board });
    const elsewhere = await atApi(new Request(`${board}/projects`));
    expect(elsewhere.url).toBe(`${board}/projects`);
    const pagePath = await atApi(new Request(`${page}/projects`));
    expect(pagePath.url).toBe(`${page}/projects`);
  });

  it("builds API and board urls from the configured origins", () => {
    setRuntimeConfig({ apiOrigin: "https://api.example", boardOrigin: board });
    expect(apiOrigin()).toBe("https://api.example");
    expect(apiUrl("/api/public/auth")).toBe("https://api.example/api/public/auth");
    expect(boardUrl("/board_cards")).toBe(`${board}/board_cards`);
  });
});
