import findUp from "find-up";
import path from "path";
import fs from "fs-extra";
import terminalLink from "terminal-link";
import issueRegex from "issue-regex";

import { BasePkgFields } from "./definitions";

export function pkgDir(cwd?: string) {
  const filePath = findUp.sync("package.json", { cwd });
  return filePath && path.dirname(filePath);
}

export function getPackageJson(cwd?: string): BasePkgFields {
  const filePath = findUp.sync("package.json", { cwd });

  if (filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(err);
    }
  }

  return { name: "", version: "" };
}

export function linkifyIssues(url: string, message: string) {
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

export function linkifyCommit(url: string, commit: string) {
  if (!(url && terminalLink.isSupported)) {
    return commit;
  }

  return terminalLink(commit, `${url}/commit/${commit}`);
}

export function linkifyCommitRange(url: string, commitRange: string) {
  if (!(url && terminalLink.isSupported)) {
    return commitRange;
  }

  return terminalLink(commitRange, `${url}/compare/${commitRange}`);
}
