import chalk from "chalk";
import fs from "fs-extra";

import { CliOptions } from "./definitions";
import { Version } from "./version";
import { Git } from "./git";
import { Spinner, info, warn } from "@luban-cli/cli-shared-utils";
import { Npm } from "./npm";
import { getPackageJson } from "./share";
import { Reminder } from "./constant";

import { publish } from "./publish";
import { runScripts } from "./runScripts";

export async function run(
  inputVersion: string | undefined,
  options: CliOptions,
) {
  const pkg = getPackageJson();
  const spin = new Spinner();

  const version = new Version(inputVersion || "");
  await version.prepare();

  spin.logWithSpinner(`${chalk.bgCyan("Prepare")} npm... `);
  const npm = new Npm(version, pkg, options);
  await npm.prepare();
  spin.stopSpinner();

  spin.logWithSpinner(`${chalk.bgCyan("Prepare")} git... `);
  const git = new Git(version, pkg, options);
  await git.prepare();
  spin.stopSpinner();

  if (options.clean) {
    spin.logWithSpinner(`${chalk.bgCyan("Clean")} dependencies  ... `);
    await fs.remove("node_modules");
    spin.stopSpinner();

    spin.logWithSpinner(`${chalk.bgCyan("Install")} dependencies ... `);
    await Npm.installDependency();
    spin.stopSpinner();
  }

  if (options.runScripts) {
    await runScripts(options.runScripts, pkg);
  }

  console.log();
  spin.logWithSpinner(`${chalk.bgCyan("Publish")} bumping version ... `);
  await Npm.bumpVersion(version.getNewVersion());
  spin.stopSpinner();

  spin.logWithSpinner(`${chalk.bgCyan("Publish")} publish package ... `);
  publish(options, pkg, async (status) => {
    spin.stopSpinner();

    const hasUpstream = await Git.hasUpstream();

    if (hasUpstream) {
      if (status === "SUCCESS") {
        spin.logWithSpinner(`${chalk.bgCyan("Publish")} push git tag ... `);
        await Git.pushGraceful();
        spin.stopSpinner();
      } else {
        warn(Reminder.git.notPushTag);
      }
    } else {
      warn(Reminder.git.upstreamInexistence);
    }

    if (status === "SUCCESS") {
      const newPkg = getPackageJson();
      console.log();
      info(`${newPkg.name} ${newPkg.version} published 🎉`);
    }
  });
}
