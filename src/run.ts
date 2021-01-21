import chalk from "chalk";
import { CliOptions } from "./definitions";
import { Version } from "./version";
import { Git } from "./git";

import { Spinner } from "@luban-cli/cli-shared-utils";
import { Npm } from "./npm";
import { getPackageJson } from "./pkg";

export async function run(
  inputVersion: string | undefined,
  options: CliOptions,
) {
  const pkg = getPackageJson();
  const spin = new Spinner();

  const version = new Version(inputVersion || "");
  await version.prepare();

  spin.logWithSpinner(`${chalk.bgGreen("Prepare")} npm...`);
  const npm = new Npm(version, options, pkg);
  await npm.prepare();
  spin.stopSpinner();

  spin.logWithSpinner(`${chalk.bgGreen("Prepare")} git...`);
  const git = new Git(options, pkg);
  await git.prepare();
  spin.stopSpinner();
}
