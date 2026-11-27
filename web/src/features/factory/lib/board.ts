/**
 * factory-board from the web (ADR 0073). The generated CrateStack SDK is vendored in
 * `lib/board/sdk` from the sibling repository; this is the web's own use of it: one client per call,
 * built from the runtime configuration. With `boardOrigin` set the SDK talks to the board's own edge
 * (routes at `/`); without it the factory Caddy serves the same routes at same-origin `/board/*`,
 * stripping the prefix with `handle_path`.
 *
 * Cookies belong to the edge's oauth2-proxy, which copies the verified Bearer token to
 * factory-board, so the browser sends credentials and no token or secret of its own. A separate
 * `boardOrigin` needs the edge's cookie to be usable across origins (SameSite=None, Secure).
 *
 * Mutations carry a stable `Idempotency-Key`: a retried kickoff must not make a second project,
 * pre-flight record or card when the network lost the answer.
 */

import { OWN_CATALOG, UI_CATALOG_PROP } from "@/features/chat/lib/a2ui/catalog";
import { authenticatedFetch } from "@/lib/auth/fetch";
import type { BoardCard, Project, StorePreflight } from "@/lib/board/sdk";
import { FactoryBoardSdkClient } from "@/lib/board/sdk";
import { apiOrigin, boardBasePath, boardOrigin } from "@/lib/runtime-config";
import {
  ARCHITECT_AGENT_ID,
  isValidRepo,
  isValidSlug,
  type KickoffAnswers,
  preflightReady,
  seedMessage,
} from "./gate";

export type { BoardCard, Project, StorePreflight };

const withCredentials: typeof fetch = (input, init) =>
  globalThis.fetch(input, { ...init, credentials: "include" });

/** A client for the board edge of this page load; call in the browser, after `/config.json` is read. */
export function boardClient(): FactoryBoardSdkClient {
  const origin = boardOrigin();
  if (!origin) throw new Error("factory-board needs a page origin");
  return new FactoryBoardSdkClient(origin, {
    basePath: boardBasePath(),
    fetch: withCredentials,
  });
}

export type Kickoff = {
  project: Project;
  preflight: StorePreflight;
  card: BoardCard;
};

/**
 * Persist the project, the verified pre-flight record and the first card, in that order. The card
 * owns the 1:1 thread id, which factory-board mints; nothing here creates an orchestrator thread.
 */
export async function kickoff(
  client: FactoryBoardSdkClient,
  answers: KickoffAnswers,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<Kickoff> {
  if (!preflightReady(answers)) throw new Error("the Store Pre-flight Gate is not complete");
  if (!isValidSlug(answers.slug) || !isValidRepo(answers.repoFullName)) {
    throw new Error("the project slug or repository is not valid");
  }
  const headers = { "Idempotency-Key": idempotencyKey };
  const project = await client.procedures.createProject(
    {
      args: {
        name: answers.name.trim(),
        slug: answers.slug.trim(),
        repoFullName: answers.repoFullName.trim(),
        defaultBranch: answers.defaultBranch.trim() || "main",
        deployUrl: null,
      },
    },
    { headers, signal },
  );
  if (!project.id) throw new Error("factory-board made a project without an id");
  const preflight = await client.procedures.upsertStorePreflight(
    {
      args: {
        projectId: project.id,
        androidPackageName: answers.androidPackageName.trim(),
        iosBundleId: answers.iosBundleId.trim(),
        playAppCreated: answers.playAppCreated,
        ascAppCreated: answers.ascAppCreated,
        signingReady: answers.signingReady,
      },
    },
    { headers, signal },
  );
  const card = await client.procedures.createCard(
    {
      args: {
        projectId: project.id,
        title: `Bootstrap ${answers.name.trim()}`,
        description: seedMessage(answers),
        agentId: ARCHITECT_AGENT_ID,
        branchName: `feat/${answers.slug.trim()}-bootstrap`,
        toolPreset: null,
        column: "backlog",
        position: 0,
      },
    },
    { headers, signal },
  );
  return { project, preflight, card };
}

/**
 * Send the card's seed to `adam-architect` through the existing AG-UI route. The first message of a
 * new thread creates it under the person's identity, with the web's A2UI catalog sent along so the
 * architect can answer with a surface the chat can draw (ADR 0023, ADR 0012). The orchestrator owns
 * the run: leaving the stream unread here does not stop it, and the page links to the thread.
 */
export async function dispatchArchitect(
  threadId: string,
  answers: KickoffAnswers,
  idempotencyKey: string,
): Promise<void> {
  const origin = apiOrigin();
  if (!origin) throw new Error("the orchestrator needs a page origin");
  // The key the board calls used is also the message id: a kickoff retried after a lost answer
  // sends the same message to the same thread, so the orchestrator folds it into the one run.
  const request = new Request(`${origin}/agui/agents/${ARCHITECT_AGENT_ID}`, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId,
      runId: idempotencyKey,
      protocolVersion: "1.0",
      messages: [{ id: idempotencyKey, role: "user", content: seedMessage(answers) }],
      state: {},
      tools: [],
      context: [],
      forwardedProps: { [UI_CATALOG_PROP]: OWN_CATALOG },
    }),
  });
  const response = await authenticatedFetch(request);
  if (!response.ok) {
    const text = (await response.text()).slice(0, 300);
    throw new Error(`adam-architect refused the kickoff (${response.status}): ${text}`.trim());
  }
}
