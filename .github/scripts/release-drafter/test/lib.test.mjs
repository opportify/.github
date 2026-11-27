import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpVersion, resolveVersion, formatReleaseNotes } from "../lib.mjs";

const resolver = {
  "version-resolver": {
    major: { labels: ["major"] },
    minor: { labels: ["minor", "feature", "enhancement"] },
    patch: { labels: ["patch", "fix", "chore"] },
    default: "patch",
  },
};
const pr = (number, title, labels = [], login = "dev") => ({
  number,
  title,
  user: { login },
  labels: labels.map((name) => ({ name })),
});

test("bumpVersion bumps and resets lower parts", () => {
  assert.equal(bumpVersion("v1.2.3", "major"), "2.0.0");
  assert.equal(bumpVersion("v1.2.3", "minor"), "1.3.0");
  assert.equal(bumpVersion("v1.2.3", "patch"), "1.2.4");
});

test("bumpVersion handles missing tag, short tags and pre-release suffixes", () => {
  assert.equal(bumpVersion(undefined, "patch"), "0.0.1");
  assert.equal(bumpVersion("v1.2", "patch"), "1.2.1");
  assert.equal(bumpVersion("v1.2.3-beta.1", "patch"), "1.2.4");
});

test("bumpVersion rejects unparseable tags", () => {
  assert.throws(() => bumpVersion("release-x", "patch"), /Cannot parse semver/);
});

test("resolveVersion: highest bump wins", () => {
  assert.equal(resolveVersion("v1.0.0", resolver, [pr(1, "a", ["fix"]), pr(2, "b", ["feature"])]), "1.1.0");
  assert.equal(resolveVersion("v1.0.0", resolver, [pr(1, "a", ["major"]), pr(2, "b", ["feature"])]), "2.0.0");
});

test("resolveVersion: falls back to default when no label matches", () => {
  assert.equal(resolveVersion("v1.0.0", resolver, [pr(1, "a", ["unrelated"])]), "1.0.1");
});

test("formatReleaseNotes: flat 'What's Changed' list without categories", () => {
  const config = { template: "## What's Changed\n$CHANGES" };
  const notes = formatReleaseNotes(config, [pr(10, "feat: one", ["feature"]), pr(11, "fix: two", ["fix"])]);
  assert.equal(notes, "## What's Changed\n- feat: one @dev (#10)\n- fix: two @dev (#11)");
});

test("formatReleaseNotes: categories bucket PRs, uncategorised go last", () => {
  const config = { categories: [{ title: "Features", labels: ["feature"] }] };
  const notes = formatReleaseNotes(config, [pr(1, "a", ["fix"]), pr(2, "b", ["feature"])]);
  assert.equal(notes, "## Features\n\n- b @dev (#2)\n\n- a @dev (#1)");
});

test("formatReleaseNotes: escapes title characters and fills template variables", () => {
  const config = {
    "change-title-escapes": "_*",
    template: "$CHANGES\n$OWNER/$REPOSITORY $PREVIOUS_TAG...v$RESOLVED_VERSION",
  };
  const notes = formatReleaseNotes(config, [pr(3, "fix my_var *now*")], {
    owner: "example-org", repo: "example-repo", previousTag: "v1.0.0", nextVersion: "1.0.1",
  });
  assert.equal(notes, "- fix my\\_var \\*now\\* @dev (#3)\nexample-org/example-repo v1.0.0...v1.0.1");
});
