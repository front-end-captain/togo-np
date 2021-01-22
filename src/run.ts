import chalk from "chalk";
import fs from "fs-extra";

import { CliOptions } from "./definitions";
import { Version } from "./version";
import { Git } from "./git";
import { done, error, Spinner } from "@luban-cli/cli-shared-utils";
import { Npm } from "./npm";
import { getPackageJson } from "./share";

export async function run(
  inputVersion: string | undefined,
  options: CliOptions,
) {
  const pkg = getPackageJson();
  const spin = new Spinner();

  const version = new Version(inputVersion || "");
  await version.prepare();

  spin.logWithSpinner(`${chalk.bgGreen("Prepare")} npm... `);
  const npm = new Npm(version, options, pkg);
  await npm.prepare();
  spin.stopSpinner();

  spin.logWithSpinner(`${chalk.bgGreen("Prepare")} git... `);
  const git = new Git(options, pkg, version);
  await git.prepare();
  spin.stopSpinner();

  if (options.clean) {
    spin.logWithSpinner(`${chalk.bgGreen("Clean")} dependencies  ... `);
    await fs.remove("node_modules");
    spin.stopSpinner();

    spin.logWithSpinner(`${chalk.bgGreen("Install")} dependencies ... `);
    await Npm.installDependency();
    spin.stopSpinner();
  }

  if (options.runScripts) {
    const scripts = options.runScripts.split(" ");

    const allScripts = Object.keys(pkg.scripts || {});

    const availableScripts = scripts.filter((s) => allScripts.includes(s));

    if (Array.isArray(scripts)) {
      await Promise.all(
        availableScripts.map(async (script) => {
          return new Promise((resolve) => {
            Npm.runSpecifyScript(script)
              .then(({ stdout }) => {
                console.log(stdout);
                resolve(undefined);
                done(script, "Run");
              })
              .catch((err) => {
                console.log();
                error(script, "Run");
                console.log(err.stdout);
                process.exit(0);
              });
          });
        }),
      );
    }
  }

  spin.logWithSpinner(`${chalk.bgGreen("Publish")} bumping version ... `);
  await Npm.bumpVersion(version.getNewVersion());
  spin.stopSpinner();
}
