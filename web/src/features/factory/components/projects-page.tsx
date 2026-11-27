"use client";

import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { InlineStatus } from "@/components/inline-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type BoardCard,
  boardClient,
  type Kickoff,
  type Project,
  type StorePreflight,
} from "../lib/board";
import { KickoffWizard } from "./kickoff-wizard";

type Portfolio = {
  projects: Project[];
  preflights: StorePreflight[];
  cards: BoardCard[];
};

const preflightOf = (preflights: StorePreflight[], project: Project) =>
  preflights.find((preflight) => preflight.projectId === project.id);

/** Whether the E1-T0 answers on a stored pre-flight record pass the gate (ADR 0073). */
const passed = (preflight: StorePreflight | undefined): boolean =>
  !!preflight?.playAppCreated && !!preflight?.ascAppCreated && !!preflight?.signingReady;

/**
 * `/projects` (E5-T3): the portfolio of factory projects and the entry point to the Kickoff Wizard.
 * This page only reads from factory-board; the wizard writes. A card's seed chat is a 1:1 thread, so
 * the link opens `/threads/<card.threadId>` rather than one shared conversation.
 */
export function ProjectsPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [created, setCreated] = useState<Kickoff | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = boardClient();
      const [projects, preflights, cards] = await Promise.all([
        client.projects.list(),
        client.storePreflights.list(),
        client.boardCards.list(),
      ]);
      setPortfolio({ projects, preflights, cards });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "factory-board could not be read.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreated = (result: Kickoff) => {
    setCreated(result);
    setWizard(false);
    void load();
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            App factory portfolio. A kickoff seeds the repository, its store pre-flight record and
            one board card with its own chat thread.
          </p>
        </div>
        <Button type="button" onClick={() => setWizard(true)}>
          <PlusIcon aria-hidden="true" /> New project
        </Button>
      </div>

      {created ? (
        <InlineStatus role="status">
          Created <span className="font-medium">{created.project.name}</span>.{" "}
          <Link className="underline" href={`/threads/${created.card.threadId}`}>
            Open the seed chat
          </Link>
          .
        </InlineStatus>
      ) : null}

      {error ? (
        <InlineStatus
          tone="error"
          role="alert"
          action={{ label: "Retry", onClick: () => void load() }}
        >
          {error}
        </InlineStatus>
      ) : null}

      {!portfolio && !error ? <InlineStatus role="status">Loading projects…</InlineStatus> : null}

      {portfolio && portfolio.projects.length === 0 ? (
        <InlineStatus role="status">
          No projects yet. Start with the store accounts and signing of E1-T0, then create a
          project.
        </InlineStatus>
      ) : null}

      <div className="grid gap-3">
        {portfolio?.projects.map((project) => {
          const preflight = preflightOf(portfolio.preflights, project);
          const card = portfolio.cards.find((item) => item.projectId === project.id);
          return (
            <Card key={project.id}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">{project.name}</CardTitle>
                <Badge variant={passed(preflight) ? "default" : "outline"}>
                  {passed(preflight) ? "Store gate passed" : "Store gate pending"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono">{project.slug}</span>
                <span className="break-all">{project.repoFullName}</span>
                <span>{project.defaultBranch ?? "main"}</span>
                {card ? (
                  <Link
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                    href={`/threads/${card.threadId}`}
                  >
                    Seed chat <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {wizard ? <KickoffWizard onCreated={onCreated} onClose={() => setWizard(false)} /> : null}
    </main>
  );
}
