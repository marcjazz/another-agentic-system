"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useRef, useState } from "react";
import { InlineStatus } from "@/components/inline-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uuidv7 } from "@/lib/uuid";
import { boardClient, dispatchArchitect, type Kickoff, kickoff } from "../lib/board";
import { isValidRepo, isValidSlug, type KickoffAnswers, preflightMissing } from "../lib/gate";

const EMPTY: KickoffAnswers = {
  name: "",
  slug: "",
  repoFullName: "",
  defaultBranch: "main",
  androidPackageName: "",
  iosBundleId: "",
  playAppCreated: false,
  ascAppCreated: false,
  signingReady: false,
};

const STEPS = ["Project", "Store pre-flight", "Review"] as const;

/**
 * The Kickoff Wizard (E5-T3). Three short steps: the repository to seed, the E1-T0 answers, then a
 * review. The dispatch button stays disabled until every store answer is given: a person cannot
 * skip the gate with a double click or by going straight to the review step. One click persists the
 * project, its pre-flight record and the first card through the typed board SDK, then sends the
 * card's seed to `adam-architect` on the card's own, 1:1 thread.
 */
export function KickoffWizard({
  onCreated,
  onClose,
}: {
  onCreated: (created: Kickoff) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<KickoffAnswers>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key for this wizard, kept across clicks: a retry after a lost answer finds the records
  // already made instead of making a second project. The board refuses a changed body under it.
  const key = useRef<string | undefined>(undefined);

  const missing = preflightMissing(answers);
  const detailsOk =
    answers.name.trim().length > 0 &&
    isValidSlug(answers.slug) &&
    isValidRepo(answers.repoFullName) &&
    answers.defaultBranch.trim().length > 0;
  const ready = missing.length === 0;
  const canAdvance = step === 0 ? detailsOk : step === 1 ? ready : true;

  const text = (key: keyof KickoffAnswers, value: string) =>
    setAnswers((before) => ({ ...before, [key]: value }));
  const check = (key: keyof KickoffAnswers, value: boolean) =>
    setAnswers((before) => ({ ...before, [key]: value }));

  const submit = async () => {
    if (!ready || !detailsOk || busy) return;
    const idempotencyKey = key.current ?? uuidv7();
    key.current = idempotencyKey;
    setBusy(true);
    setError(null);
    try {
      const created = await kickoff(boardClient(), answers, idempotencyKey);
      if (!created.card.threadId) throw new Error("factory-board made a card without a thread id");
      await dispatchArchitect(created.card.threadId, answers, idempotencyKey);
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The kickoff could not be finished.");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Seed a repository and a first board card. The store pre-flight gate comes before the
            architect is dispatched.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-2 text-xs" aria-label="Kickoff steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={index === step ? "font-semibold text-brand" : "text-muted-foreground"}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kickoff-name">Project name</Label>
              <Input
                id="kickoff-name"
                value={answers.name}
                disabled={busy}
                onChange={(event) => text("name", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kickoff-slug">Slug</Label>
              <Input
                id="kickoff-slug"
                value={answers.slug}
                disabled={busy}
                placeholder="shop-android"
                aria-invalid={answers.slug.length > 0 && !isValidSlug(answers.slug)}
                onChange={(event) => text("slug", event.target.value)}
              />
              {answers.slug.length > 0 && !isValidSlug(answers.slug) ? (
                <InlineStatus tone="warning">
                  Lower-case letters, digits and hyphens only.
                </InlineStatus>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kickoff-repo">Repository</Label>
              <Input
                id="kickoff-repo"
                value={answers.repoFullName}
                disabled={busy}
                placeholder="owner/repository"
                aria-invalid={answers.repoFullName.length > 0 && !isValidRepo(answers.repoFullName)}
                onChange={(event) => text("repoFullName", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kickoff-branch">Default branch</Label>
              <Input
                id="kickoff-branch"
                value={answers.defaultBranch}
                disabled={busy}
                onChange={(event) => text("defaultBranch", event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4">
            <InlineStatus tone="warning">
              The Play Console app and the App Store Connect record are made by hand: the API cannot
              make either one. Confirm they exist before dispatching the architect.
            </InlineStatus>
            <div className="grid gap-2">
              <Label htmlFor="kickoff-android">Android package name</Label>
              <Input
                id="kickoff-android"
                value={answers.androidPackageName}
                disabled={busy}
                placeholder="com.example.shop"
                onChange={(event) => text("androidPackageName", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kickoff-ios">iOS bundle id</Label>
              <Input
                id="kickoff-ios"
                value={answers.iosBundleId}
                disabled={busy}
                placeholder="com.example.shop"
                onChange={(event) => text("iosBundleId", event.target.value)}
              />
            </div>
            {(
              [
                [
                  "playAppCreated",
                  "The Play Console app exists and its first build is uploaded to the internal track.",
                ],
                ["ascAppCreated", "The App Store Connect My Apps record exists."],
                [
                  "signingReady",
                  "The distribution certificate, provisioning profile and upload credentials are ready.",
                ],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-start gap-2">
                <input
                  id={`kickoff-${key}`}
                  type="checkbox"
                  className="mt-1 size-4 accent-brand"
                  checked={answers[key]}
                  disabled={busy}
                  onChange={(event) => check(key, event.target.checked)}
                />
                <Label htmlFor={`kickoff-${key}`} className="font-normal">
                  {label}
                </Label>
              </div>
            ))}
            {missing.length > 0 ? (
              <InlineStatus tone="warning" role="status">
                Still needed: {missing.join("; ")}.
              </InlineStatus>
            ) : (
              <InlineStatus role="status">Store pre-flight passed.</InlineStatus>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {(
              [
                ["Project", answers.name],
                ["Slug", answers.slug],
                ["Repository", answers.repoFullName],
                ["Default branch", answers.defaultBranch],
                ["Android package", answers.androidPackageName],
                ["iOS bundle id", answers.iosBundleId],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="col-span-2 grid grid-cols-subgrid">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <InlineStatus role="status">
                Store pre-flight passed: Play app, App Store Connect record and signing confirmed.
              </InlineStatus>
            </div>
          </dl>
        ) : null}

        {error ? (
          <InlineStatus tone="error" role="alert">
            {error}
          </InlineStatus>
        ) : null}

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || busy}
            onClick={() => setStep((before) => before - 1)}
          >
            <ArrowLeftIcon aria-hidden="true" /> Back
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((before) => before + 1)}
            >
              Next <ArrowRightIcon aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" disabled={!ready || busy} onClick={() => void submit()}>
              {busy ? "Creating…" : "Create project & seed thread"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
