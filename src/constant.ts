export const PRERELEASE_VERSIONS = [
  "prepatch",
  "preminor",
  "premajor",
  "prerelease",
];

export const SEMVER_INCREMENTS = [
  "patch",
  "minor",
  "major",
  "prepatch",
  "preminor",
  "premajor",
  "prerelease",
];

export const Reminder = {
  version: {
    invalidInputVersion: `Version should be either ${SEMVER_INCREMENTS.join(
      ", ",
    )} or a valid semver version.`,
    invalidVersion:
      "Version should be a valid semver version, for example, `1.2.3`. See https://semver.org.",
    lowerThanOrEqualTo: (v1: string, v2: string) =>
      `Version ${v1} must be greater than ${v2}.`,
    shouldUpgradeDependency: (dependency: string, depRange: string) =>
      `Please upgrade to ${dependency}${depRange}.`,
  },
  npm: {
    shouldSpecifyTag:
      "You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as 'latest'. https://docs.npmjs.com/cli/dist-tag'.",
    pingFailed: (registry: string) =>
      `Connection to npm registry(${registry}) failed.`,
    unLogin: "You must be logged in. Use `npm login` and try again.",
    unAuth: "Authentication error. Use `npm whoami` to troubleshoot.",
    unPublish:
      "You do not have write permissions required to publish this package.",
    publishFail: (msg: string) =>
      `Error publishing package:\n${msg}\n\nThe project was rolled back to its previous state.`,
    startRollback: "\nPublish failed. Rolling back to the previous state…",
    rollbackOk: "Successfully rolled back the project to its previous state.",
    rollbackFail: (err: any) =>
      `Couldn't roll back because of the following error:\n${err}.`,
  },
  git: {
    noCommits: "No commits found since previous release, exit.",
    notPublishYet: "The package has not been published yet.",
    notFoundBranch:
      "Could not infer the default Git branch. Please specify one with the --branch flag or with a np config.",
    shouldPullChanges: "Remote history differs. Please pull changes.",
    unClean: "Unclean working tree. Commit or stash changes first.",
    branchNotExistsOnRemote: (branch: string) =>
      `Git branch \`${branch}\` not exists.`,
    branchShouldReleaseBranch: (releaseBranch: string) =>
      `Not on \`${releaseBranch}\` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.`,
    upstreamInexistence: "Upstream branch not found; not pushing.",
    notPushTag: "Couldn't publish package to npm; not pushing.",
  },
};
