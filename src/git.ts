/* eslint-disable no-empty */
import execa from "execa";
import ignoreWalker from "ignore-walk";
import githubUrlFromGit from "github-url-from-git";
import { BasePkgFields, CliOptions } from "./definitions";

import {
  pkgDir,
  linkifyCommit,
  linkifyCommitRange,
  linkifyIssues,
} from "./share";
import { Npm } from "./npm";
import { error, info } from "@luban-cli/cli-shared-utils";
import { Version } from "./version";
import { Reminder } from "./constant";

class Git {
  private options: CliOptions;
  private repoUrl: string | undefined;
  private pkg: BasePkgFields;
  private version: Version;

  private newTag: string;
  private releaseBranch: string;

  constructor(options: CliOptions, pkg: BasePkgFields, version: Version) {
    this.options = options;

    this.pkg = pkg;

    this.version = version;

    this.newTag = "";
    this.releaseBranch = "";

    this.repoUrl =
      this.pkg.repository &&
      githubUrlFromGit(this.pkg.repository.url, {
        extraBaseUrls: ["gitlab.com"],
      });
  }

  public async prepare() {
    const defaultBranch = await Git.getDefaultBranch();

    if (this.repoUrl) {
      const registryUrl = await Npm.getRegistryUrl(this.pkg);

      const hasCommits = await Git.printCommitLog(
        this.repoUrl,
        registryUrl,
        this.options.branch || defaultBranch,
      );

      if (!hasCommits) {
        error(Reminder.git.noCommits);
        process.exit(1);
      }
    }

    await Git.verifyGitVersion(this.pkg);

    await Git.verifyRemoteIsValid();

    await this.checkGitTagExistence();

    await this.verifyRemoteHistoryIsClean();

    if (!process.env._TOGO_DEBUG_) {
      await this.verifyWorkingTreeIsClean();
    }

    // 指定的分支或者当前分支是否是允许发布的分支(if allowAnyBranch = false)
    if (!this.options.allowAnyBranch && this.options.branch) {
      await this.verifyCurrentBranchIsReleaseBranch(this.options.branch);
    }

    const releaseBranch = this.options.allowAnyBranch
      ? defaultBranch
      : this.options.branch || defaultBranch;

    this.releaseBranch = releaseBranch;

    await this.checkGitBranchExistence(releaseBranch);
  }

  public getNewTag() {
    return this.newTag;
  }

  public getReleaseBranch() {
    return this.releaseBranch;
  }

  public getRepoUrl() {
    return this.repoUrl;
  }

  static async printCommitLog(
    repoUrl: string,
    registryUrl: string,
    releaseBranch: string,
  ) {
    const revision = await Git.getLatestTagOrFirstCommitID();

    if (!revision) {
      error(Reminder.git.notPublishYet);
      process.exit(1);
    }

    const log = await Git.commitLogFromRevision(revision);

    if (!log) {
      return false;
    }

    const commitRangeText = `${revision}...${releaseBranch}`;

    const commits = log.split("\n").map((commit) => {
      const splitIndex = commit.lastIndexOf(" ");

      return {
        message: commit.slice(0, splitIndex),
        id: commit.slice(splitIndex + 1),
      };
    });

    const history = commits
      .map((commit) => {
        const commitMessage = linkifyIssues(repoUrl, commit.message);
        const commitId = linkifyCommit(repoUrl, commit.id);
        return `${commitMessage}  ${commitId}`;
      })
      .join(" | ");

    const commitRange = linkifyCommitRange(repoUrl, commitRangeText);

    console.log("\n");
    info(history, "Commits");
    info(commitRange, "Commit Range");
    info(registryUrl, "Registry");
    console.log("");

    return true;
  }

  static git(args: readonly string[], options?: execa.Options) {
    return execa("git", args, options);
  }

  static async getLatestTag() {
    const { stdout } = await Git.git(["describe", "--abbrev=0", "--tags"]);
    return stdout;
  }

  static async getPrevTag() {
    let prevTag = "";

    try {
      const { stdout } = await Git.git(["tag"]);
      const tags = stdout.split("\n");
      if (tags.length > 1) {
        prevTag = tags[tags.length - 2];
      }
    } catch (ignoreError) {}

    return prevTag;
  }

  static async getFilesOfAfterLatestReleased() {
    try {
      const latestTag = await Git.getLatestTag();

      const { stdout } = await Git.git([
        "diff",
        "--name-only",
        "--diff-filter=A",
        latestTag,
        "HEAD",
      ]);

      if (stdout.trim().length === 0) {
        return [];
      }

      const result = stdout
        .trim()
        .split("\n")
        .map((row) => row.trim());

      return result;
    } catch {
      return ignoreWalker({
        path: pkgDir(),
        ignoreFiles: [".gitignore"],
      });
    }
  }

  static async getFirstCommitID() {
    let firstCommitID = "";
    try {
      const { stdout } = await Git.git(["rev-list", "--max-parents=0", "HEAD"]);
      firstCommitID = stdout;
    } catch (ignoreError) {}
    return firstCommitID;
  }

  static async getLatestTagOrFirstCommitID() {
    let latest = "";

    try {
      latest = await Git.getLatestTag();
    } catch (ignoreError) {
      latest = await Git.getFirstCommitID();
    }

    return latest;
  }

  static async commitLogFromRevision(revision: string) {
    let log = "";

    try {
      const { stdout } = await Git.git([
        "log",
        "--format=%s %h",
        `${revision}..HEAD`,
      ]);
      log = stdout;
    } catch (ignoreError) {}

    return log;
  }

  static async getDefaultBranch() {
    for (const branch of ["main", "master"]) {
      if (await Git.hasLocalBranch(branch)) {
        return branch;
      }
    }

    error(Reminder.git.notFoundBranch);
    process.exit(1);
  }

  static async hasLocalBranch(branch: string) {
    try {
      await Git.git([
        "show-ref",
        "--verify",
        "--quiet",
        `refs/heads/${branch}`,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  static async getVersion() {
    const { stdout } = await Git.git(["version"]);

    const match = /git version (?<version>\d+\.\d+\.\d+).*/.exec(stdout);

    return match && match.groups?.version;
  }

  static async verifyRemoteIsValid() {
    try {
      await Git.git(["ls-remote", "origin", "HEAD"]);
    } catch (error) {
      error(error.stderr.replace("fatal:", "Git fatal error:"));
      process.exit(1);
    }
  }

  static async verifyGitVersion(pkg: BasePkgFields) {
    const gitVersion = await Git.getVersion();
    if (gitVersion) {
      Version.verifyRequirementSatisfied("npm", gitVersion, pkg);
    }
  }

  static async fetch() {
    await Git.git(["fetch"]);
  }

  static async verifyTagDoesNotExistOnRemote(tagName: string) {
    if (await Git.tagExistsOnRemote(tagName)) {
      error(`Git tag \`${tagName}\` already exists.`);

      process.exit(1);
    }
  }

  static async tagExistsOnRemote(tagName: string) {
    try {
      const { stdout: revInfo } = await Git.git([
        "rev-parse",
        "--quiet",
        "--verify",
        `refs/tags/${tagName}`,
      ]);

      if (revInfo) {
        return true;
      }

      return false;
    } catch (err) {
      if (err.stdout === "" && err.stderr === "") {
        return false;
      }

      error(err);
      process.exit(1);
    }
  }

  static async verifyBranchDoesNotExistOnRemote(branch: string) {
    const branchExistsOnRemote = await Git.branchExistsOnRemote(branch);

    if (!branchExistsOnRemote) {
      error(Reminder.git.branchNotExistsOnRemote(branch));

      process.exit(1);
    }
  }

  static async branchExistsOnRemote(branch: string) {
    try {
      const { stdout: refInfo } = await Git.git([
        "show-ref",
        "--verify",
        `refs/remotes/origin/${branch}`,
      ]);

      if (refInfo) {
        return true;
      }

      return false;
    } catch (err) {
      if (err.stdout === "" && err.stderr === "") {
        return false;
      }

      error(err);
      process.exit(1);
    }
  }

  private async checkGitTagExistence() {
    await Git.fetch();

    const tagPrefix = await Npm.getTagVersionPrefix();

    const newTag = `${tagPrefix}${this.version.getNewVersion()}`;

    await Git.verifyTagDoesNotExistOnRemote(newTag);

    this.newTag = newTag;
  }

  private async checkGitBranchExistence(branch: string) {
    await Git.fetch();

    await Git.verifyBranchDoesNotExistOnRemote(branch);
  }

  private async verifyRemoteHistoryIsClean() {
    const isRemoteHistoryClean = await Git.isRemoteHistoryClean();
    if (!isRemoteHistoryClean) {
      error(Reminder.git.shouldPullChanges);
      process.exit(1);
    }
  }

  private async verifyWorkingTreeIsClean() {
    const isWorkingTreeClean = await Git.isWorkingTreeClean();
    if (!isWorkingTreeClean) {
      error(Reminder.git.unClean);
      process.exit(1);
    }
  }

  private async verifyCurrentBranchIsReleaseBranch(releaseBranch: string) {
    const currentBranch = await Git.getCurrentBranch();

    if (currentBranch !== releaseBranch) {
      error(Reminder.git.branchShouldReleaseBranch(releaseBranch));
      process.exit(1);
    }
  }

  static async getCurrentBranch() {
    const { stdout } = await Git.git(["symbolic-ref", "--short", "HEAD"]);
    return stdout;
  }

  static async isRemoteHistoryClean() {
    let history = "";

    try {
      const { stdout } = await Git.git([
        "rev-list",
        "--count",
        "--left-only",
        "@{u}...HEAD",
      ]);
      history = stdout;
    } catch {}

    if (history && history !== "0") {
      return false;
    }

    return true;
  }

  static async isWorkingTreeClean() {
    try {
      const { stdout: status } = await Git.git(["status", "--porcelain"]);
      if (status !== "") {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

export { Git };
