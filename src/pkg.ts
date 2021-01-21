import findUp from "find-up";
import path from "path";
import fs from "fs-extra";

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
