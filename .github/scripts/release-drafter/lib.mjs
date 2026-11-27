// Pure release logic, kept free of env/API side effects so it can be unit tested.

export function bumpVersion(tag, bump) {
  const v = (tag ?? "0.0.0").replace(/^v/, "");
  // Strip pre-release and build-metadata suffixes (e.g. -beta.1, -alpha, +sha)
  // so tags like v1.2.3-beta are treated as 1.2.3 rather than producing NaN.
  const base = v.replace(/[-+].*$/, "");
  const parts = base.split(".").map(Number);
  while (parts.length < 3) parts.push(0);

  if (parts.some((p) => !Number.isInteger(p) || p < 0)) {
    throw new Error(
      `Cannot parse semver from tag "${tag}". Expected format: vMAJOR.MINOR.PATCH (pre-release suffixes are stripped automatically).`,
    );
  }

  if (bump === "major") {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
  } else if (bump === "minor") {
    parts[1]++;
    parts[2] = 0;
  } else {
    parts[2]++;
  }
  return parts.join(".");
}

export function resolveVersion(currentTag, config, prs) {
  const allLabels = prs.flatMap((pr) => (pr.labels ?? []).map((l) => l.name));
  const resolver = config["version-resolver"] ?? {};

  for (const bump of ["major", "minor", "patch"]) {
    const bumpLabels = resolver[bump]?.labels ?? [];
    if (allLabels.some((l) => bumpLabels.includes(l))) {
      return bumpVersion(currentTag, bump);
    }
  }
  return bumpVersion(currentTag, resolver.default ?? "patch");
}

// ---------------------------------------------------------------------------
// Release notes formatting
// ---------------------------------------------------------------------------

export function formatReleaseNotes(config, prs, { owner, repo, previousTag, nextVersion } = {}) {
  const categories = config.categories ?? [];
  const changeTemplate =
    config["change-template"] ?? "- $TITLE @$AUTHOR (#$NUMBER)";
  const template = config.template ?? "$CHANGES";
  const escapeChars = (config["change-title-escapes"] ?? "")
    .split("")
    .filter(Boolean);

  function escape(str) {
    let out = str ?? "";
    for (const ch of escapeChars) out = out.replaceAll(ch, `\\${ch}`);
    return out;
  }

  function formatLine(pr) {
    return changeTemplate
      .replace("$TITLE", escape(pr.title))
      .replace("$AUTHOR", pr.user?.login ?? "unknown")
      .replace("$NUMBER", String(pr.number));
  }

  // Bucket PRs into the first matching category.
  const buckets = new Map(categories.map((c) => [c.title, []]));
  const matched = new Set();

  for (const cat of categories) {
    for (const pr of prs) {
      if (matched.has(pr.number)) continue;
      const prLabels = (pr.labels ?? []).map((l) => l.name);
      if ((cat.labels ?? []).some((l) => prLabels.includes(l))) {
        buckets.get(cat.title).push(pr);
        matched.add(pr.number);
      }
    }
  }

  let changes = "";

  for (const cat of categories) {
    const items = buckets.get(cat.title) ?? [];
    if (items.length === 0) continue;
    changes += `## ${cat.title}\n\n`;
    for (const pr of items) changes += formatLine(pr) + "\n";
    changes += "\n";
  }

  // Any PRs with no matching category label go at the bottom unlabelled.
  const uncategorised = prs.filter((pr) => !matched.has(pr.number));
  for (const pr of uncategorised) changes += formatLine(pr) + "\n";

  return template
    .replace("$CHANGES", changes.trim())
    .replace(/\$OWNER/g, owner ?? "")
    .replace(/\$REPOSITORY/g, repo ?? "")
    .replace(/\$PREVIOUS_TAG/g, previousTag ?? "")
    .replace(/\$RESOLVED_VERSION/g, nextVersion ?? "");
}
