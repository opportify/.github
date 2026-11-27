/**
 * Opportify Release Drafter
 *
 * Reads .github/release-drafter.yml from the calling repo, finds all PRs merged
 * since the last published release, and creates or updates a draft GitHub release
 * with categorised, version-resolved release notes.
 *
 * Required env vars:
 *   GITHUB_TOKEN       — token with contents:write on the target repo
 *   GITHUB_REPOSITORY  — "owner/repo" (set automatically by GitHub Actions)
 *   WORKSPACE          — path to the checked-out calling repo
 */

import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { resolveVersion, formatReleaseNotes } from "./lib.mjs";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const token = process.env.GITHUB_TOKEN;
const workspace = process.env.WORKSPACE ?? process.cwd();
const configPath = process.env.CONFIG_PATH ?? ".github/release-drafter.yml";

if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}
if (!owner || !repo) {
  console.error("GITHUB_REPOSITORY must be set (format: owner/repo)");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function getLatestRelease() {
  try {
    const { data } = await octokit.rest.repos.getLatestRelease({ owner, repo });
    return data;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function getMergedPRsSince(since) {
  // Use GitHub Search API to find PRs merged after the given ISO timestamp.
  const sincePart = since ? `merged:>${since}` : "";
  const q = `repo:${owner}/${repo} is:pr is:merged ${sincePart}`.trim();

  const prs = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q,
      sort: "created",
      order: "desc",
      per_page: 100,
      page,
    });
    prs.push(...data.items);
    if (data.items.length < 100) break;
    page++;
  }
  return prs;
}

async function findExistingDraft() {
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 30,
      page,
    });
    const draft = data.find((r) => r.draft);
    if (draft) return draft;
    if (data.length < 30) break;
    page++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const configFile = join(workspace, configPath);
  let config;
  try {
    config = yaml.load(readFileSync(configFile, "utf8"));
  } catch (e) {
    console.error(`Cannot read release-drafter config at ${configFile}: ${e.message}`);
    process.exit(1);
  }

  const latestRelease = await getLatestRelease();
  const since =
    latestRelease?.published_at ?? latestRelease?.created_at ?? null;
  const currentTag = latestRelease?.tag_name ?? "v0.0.0";

  console.log(
    `Latest release: ${latestRelease?.tag_name ?? "none"}, cutoff: ${since ?? "all time"}`,
  );

  const prs = await getMergedPRsSince(since);
  console.log(`Merged PRs since last release: ${prs.length}`);

  if (prs.length === 0) {
    console.log("No new merged PRs — skipping draft update");
    return;
  }

  const nextVersion = resolveVersion(currentTag, config, prs);
  const releaseName = (
    config["name-template"] ?? "v$RESOLVED_VERSION"
  ).replace("$RESOLVED_VERSION", nextVersion);
  const tagName = (config["tag-template"] ?? "v$RESOLVED_VERSION").replace(
    "$RESOLVED_VERSION",
    nextVersion,
  );
  const body = formatReleaseNotes(config, prs, {
    owner,
    repo,
    previousTag: currentTag,
    nextVersion,
  });

  console.log(`Draft: "${releaseName}" (tag: ${tagName})`);

  const existingDraft = await findExistingDraft();

  if (existingDraft) {
    await octokit.rest.repos.updateRelease({
      owner,
      repo,
      release_id: existingDraft.id,
      name: releaseName,
      tag_name: tagName,
      body,
      draft: true,
    });
    console.log(`Updated draft release: ${existingDraft.html_url}`);
  } else {
    const { data } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      name: releaseName,
      tag_name: tagName,
      body,
      draft: true,
    });
    console.log(`Created draft release: ${data.html_url}`);
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
