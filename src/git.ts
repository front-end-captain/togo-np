/* eslint-disable no-empty */
import execa from "execa";
import ignoreWalker from "ignore-walk";
import githubUrlFromGit from "github-url-from-git";
import { BasePkgFields, CliOptions } from "./definitions";
import terminalLink from "terminal-link";
import issueRegex from "issue-regex";

import { pkgDir } from "./pkg";
import { Npm } from "./npm";
import { error, info } from "@luban-cli/cli-shared-utils";
import { Version } from "./version";

function linkifyIssues(url: string, message: string) {
  if (!(url && terminalLink.isSupported)) {
    return message;
  }

  return message.replace(issueRegex(), (issue) => {
    const issuePart = issue.replace("#", "/issues/");

    if (issue.startsWith("#")) {
      return terminalLink(issue, `${url}${issuePart}`);
    }

    return terminalLink(issue, `https://github.com/${issuePart}`);
  });
}

function linkifyCommit(url: string, commit: string) {
  if (!(url && terminalLink.isSupported)) {
    return commit;
  }

  return terminalLink(commit, `${url}/commit/${commit}`);
}

function linkifyCommitRange(url: string, commitRange: string) {
  if (!(url && terminalLink.isSupported)) {
    return commitRange;
  }

  return terminalLink(commitRange, `${url}/compare/${commitRange}`);
}

class Git {
  private options: CliOptions;
  private repoUrl: string | undefined;
  private pkg: BasePkgFields;
  private version: Version;

  constructor(options: CliOptions, pkg: BasePkgFields, version: Version) {
    this.options = options;

    this.pkg = pkg;

    this.version = version;

    this.repoUrl =
      this.pkg.repository &&
      githubUrlFromGit(this.pkg.repository.url, {
        extraBaseUrls: ["gitlab.com"],
      });
  }

  public async prepare() {
    if (this.repoUrl) {
      const registryUrl = await Npm.getRegistryUrl(this.pkg);

      const defaultBranch = await Git.getDefaultBranch();

      const hasCommits = await Git.printCommitLog(
        this.repoUrl,
        registryUrl,
        this.options.branch || defaultBranch,
      );

      if (!hasCommits) {
        error("No commits found since previous release, exit");
        process.exit(1);
      }
    }

    // TODO
    // 1 检查Git版本是否符合package运行要求
    // 2.检查Git远端是否可以用
    // 3.获取新的Git tag
    // 4.检查新的的Git tag 在远端仓库是否存在

    await this.checkGitTagExistence();

    // 5.检查是否有未拉去的更新(远端和本地是否同步)
    // 6.检查发布分支是否在远端仓库存在
    // 7.工作空间是否干净
    // 8.指定的分支或者当前分支是否是允许发布的分支(if allowAnyBranch = false)
  }

  static async printCommitLog(
    repoUrl: string,
    registryUrl: string,
    releaseBranch: string,
  ) {
    const revision = await Git.getLatestTagOrFirstCommitID();

    if (!revision) {
      error("The package has not been published yet.");
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
      .map((commit, index) => {
        const commitMessage = linkifyIssues(repoUrl, commit.message);
        const commitId = linkifyCommit(repoUrl, commit.id);
        const indent = index === 0 ? "" : "                ";
        return `${indent}${commitMessage}  ${commitId}`;
      })
      .join("\n");

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
      // Get all files under version control but ignored files
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
    for (const branch of ["main", "master", "gh-pages"]) {
      if (await Git.hasLocalBranch(branch)) {
        return branch;
      }
    }

    error(
      "Could not infer the default Git branch. Please specify one with the --branch flag or with a np config.",
    );
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
      // Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
      // https://github.com/sindresorhus/np/pull/73#discussion_r72385685
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

    await Git.verifyTagDoesNotExistOnRemote(
      `${tagPrefix}${this.version.getNewVersion()}`,
    );
  }
}

export { Git };
