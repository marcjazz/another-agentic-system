/**
 * The E1-T0 Store Pre-flight Gate (the MVP plan, §3.2 and E5-T3) and the seed a kickoff sends to
 * `adam-architect`. Pure: the wizard asks the person for the answers, this decides whether they are
 * enough, and nothing reaches factory-board or the orchestrator until they are.
 *
 * The store records cannot be created by an API call: a Play Console app needs a manual first
 * internal upload, and App Store Connect has no `POST /v1/apps`. An unchecked promise here would
 * strand the generated app at the first store push, so the wizard refuses to dispatch until every
 * answer is given.
 */

export type PreflightAnswers = {
  androidPackageName: string;
  iosBundleId: string;
  playAppCreated: boolean;
  ascAppCreated: boolean;
  signingReady: boolean;
};

export type KickoffAnswers = PreflightAnswers & {
  name: string;
  slug: string;
  repoFullName: string;
  defaultBranch: string;
};

/** The canonical id of the reasoning agent of the factory stack (`dev/agents.factory.yaml`). */
export const ARCHITECT_AGENT_ID = "adam-architect";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ANDROID_PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const IOS_BUNDLE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export const isValidSlug = (value: string): boolean => SLUG.test(value.trim());
export const isValidRepo = (value: string): boolean => REPO.test(value.trim());
export const isValidAndroidPackage = (value: string): boolean => ANDROID_PACKAGE.test(value.trim());
export const isValidIosBundle = (value: string): boolean => IOS_BUNDLE.test(value.trim());

/** What still stops a kickoff, in the order the wizard asks for it. */
export function preflightMissing(answers: PreflightAnswers): string[] {
  const missing: string[] = [];
  if (!isValidAndroidPackage(answers.androidPackageName)) {
    missing.push("the Android package name of the Play app");
  }
  if (!isValidIosBundle(answers.iosBundleId)) {
    missing.push("the iOS bundle id of the App Store Connect record");
  }
  if (!answers.playAppCreated) {
    missing.push("the Play Console app record and its first internal upload");
  }
  if (!answers.ascAppCreated) {
    missing.push("the App Store Connect My Apps record");
  }
  if (!answers.signingReady) {
    missing.push("the distribution certificate, provisioning profile and upload credentials");
  }
  return missing;
}

export const preflightReady = (answers: PreflightAnswers): boolean =>
  preflightMissing(answers).length === 0;

/** Everything the agent needs to start work without asking the person again (ADR 0050 handoff). */
export function seedMessage(answers: KickoffAnswers): string {
  const slug = answers.slug.trim();
  return [
    `Kick off the app factory project “${answers.name.trim()}”.`,
    `repo: ${answers.repoFullName.trim()}`,
    `branch: feat/${slug}-bootstrap`,
    "schema: schema/app.cstack",
    "context: lib/app/ (the generated app's server and client shell)",
    `android package: ${answers.androidPackageName.trim()}; iOS bundle id: ${answers.iosBundleId.trim()}`,
    "Store pre-flight is complete. Seed the repository and the initial board cards, then stop for review.",
  ].join("\n");
}
