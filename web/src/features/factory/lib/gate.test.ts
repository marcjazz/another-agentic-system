import { describe, expect, it } from "vitest";
import {
  isValidAndroidPackage,
  isValidIosBundle,
  isValidRepo,
  isValidSlug,
  preflightMissing,
  seedMessage,
} from "./gate";

const complete = {
  androidPackageName: "com.example.shop",
  iosBundleId: "com.example.shop",
  playAppCreated: true,
  ascAppCreated: true,
  signingReady: true,
};

describe("the E1-T0 Store Pre-flight Gate", () => {
  it("lets a kickoff through only when all store records and the identifiers are there", () => {
    expect(preflightMissing(complete)).toEqual([]);
    expect(preflightMissing({ ...complete, playAppCreated: false })).toEqual([
      "the Play Console app record and its first internal upload",
    ]);
    expect(
      preflightMissing({
        androidPackageName: "Shop",
        iosBundleId: "shop",
        playAppCreated: false,
        ascAppCreated: false,
        signingReady: false,
      }),
    ).toHaveLength(5);
  });

  it("does not count whitespace or a trailing dot as an identifier", () => {
    expect(isValidAndroidPackage(" com.example.shop ")).toBe(true);
    expect(isValidAndroidPackage("com.example.")).toBe(false);
    expect(isValidAndroidPackage("Com.example")).toBe(false);
    expect(isValidIosBundle("com.example.shop")).toBe(true);
    expect(isValidIosBundle("com.example")).toBe(true);
    expect(isValidIosBundle("com example")).toBe(false);
  });

  it("keeps a slug and a repository to what a branch and a GitHub name can hold", () => {
    expect(isValidSlug("shop-android")).toBe(true);
    expect(isValidSlug("Shop_android")).toBe(false);
    expect(isValidRepo("vymalo/shop-android")).toBe(true);
    expect(isValidRepo("vymalo/shop/android")).toBe(false);
  });

  it("puts the branch, schema context and both store ids in the seed", () => {
    const text = seedMessage({
      ...complete,
      name: "Shop",
      slug: "shop",
      repoFullName: "vymalo/shop",
      defaultBranch: "main",
    });
    expect(text).toContain("branch: feat/shop-bootstrap");
    expect(text).toContain("schema: schema/app.cstack");
    expect(text).toContain("context: lib/app/");
    expect(text).toContain("com.example.shop");
  });
});
