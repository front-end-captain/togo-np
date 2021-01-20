/* eslint-disable no-empty */
import execa from "execa";
import ignoreWalker from "ignore-walk";
import path from "path";
import findUp from "find-up";

function pkgDir(cwd?: string) {
  const filePath = findUp.sync("package.json", { cwd });
  return filePath && path.dirname(filePath);
}

class Git {
  static git(args: readonly string[], options?: execa.Options) {
    return execa("git", args, options);
  }

  static async getLatestTag() {
    let latestTag = "";

    try {
      const { stdout } = await Git.git(["describe", "--abbrev=0", "--tags"]);
      latestTag = stdout;
    } catch (ignoreError) {}

    return latestTag;
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
}

export { Git };
