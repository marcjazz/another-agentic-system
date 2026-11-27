import { afterEach, describe, expect, it, vi } from "vitest";
import type { FactoryBoardSdkClient } from "@/lib/board/sdk";
import { setRuntimeConfig } from "@/lib/runtime-config";
import { boardClient, kickoff } from "./board";
import { type KickoffAnswers, seedMessage } from "./gate";

const answers: KickoffAnswers = {
  name: "Shop",
  slug: "shop-android",
  repoFullName: "vymalo/shop-android",
  defaultBranch: "main",
  androidPackageName: "com.example.shop",
  iosBundleId: "com.example.shop",
  playAppCreated: true,
  ascAppCreated: true,
  signingReady: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
  setRuntimeConfig(undefined);
});

describe("the kickoff board calls", () => {
  it("writes the project, the passed pre-flight and the card with one idempotency key", async () => {
    const createProject = vi.fn().mockResolvedValue({ id: "p-1" });
    const upsertStorePreflight = vi.fn().mockResolvedValue({ id: "s-1", projectId: "p-1" });
    const createCard = vi.fn().mockResolvedValue({ id: "c-1", threadId: "t-1" });
    const client = {
      procedures: { createProject, upsertStorePreflight, createCard },
    } as unknown as FactoryBoardSdkClient;

    const result = await kickoff(client, answers, "key-1");

    expect(result.project).toEqual({ id: "p-1" });
    expect(createProject).toHaveBeenCalledWith(
      {
        args: {
          name: "Shop",
          slug: "shop-android",
          repoFullName: "vymalo/shop-android",
          defaultBranch: "main",
          deployUrl: null,
        },
      },
      { headers: { "Idempotency-Key": "key-1" }, signal: undefined },
    );
    expect(upsertStorePreflight).toHaveBeenCalledWith(
      {
        args: {
          projectId: "p-1",
          androidPackageName: "com.example.shop",
          iosBundleId: "com.example.shop",
          playAppCreated: true,
          ascAppCreated: true,
          signingReady: true,
        },
      },
      { headers: { "Idempotency-Key": "key-1" }, signal: undefined },
    );
    expect(createCard).toHaveBeenCalledWith(
      {
        args: {
          projectId: "p-1",
          title: "Bootstrap Shop",
          description: seedMessage(answers),
          agentId: "adam-architect",
          branchName: "feat/shop-android-bootstrap",
          toolPreset: null,
          column: "backlog",
          position: 0,
        },
      },
      { headers: { "Idempotency-Key": "key-1" }, signal: undefined },
    );
  });

  it("refuses to write anything while the store gate is open", async () => {
    const createProject = vi.fn();
    const client = { procedures: { createProject } } as unknown as FactoryBoardSdkClient;
    await expect(kickoff(client, { ...answers, playAppCreated: false }, "key-2")).rejects.toThrow(
      "Store Pre-flight Gate",
    );
    expect(createProject).not.toHaveBeenCalled();
  });
});

describe("the board client", () => {
  it("talks to /board on this origin by default and to / on a separate one", () => {
    vi.stubGlobal("window", { location: { origin: "https://web.example" } });
    expect(boardClient().runtime.basePath).toBe("/board");
    expect(boardClient().runtime.origin).toBe("https://web.example");

    setRuntimeConfig({ boardOrigin: "https://board.example" });
    expect(boardClient().runtime.basePath).toBe("");
    expect(boardClient().runtime.origin).toBe("https://board.example");
  });
});
