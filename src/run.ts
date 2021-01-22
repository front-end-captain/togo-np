import chalk from "chalk";
import { from } from "rxjs";
import fs from "fs-extra";
import { catchError, finalize } from "rxjs/operators";
import onetime from "onetime";

import { CliOptions } from "./definitions";
import { Version } from "./version";
import { Git } from "./git";
import { done, error, Spinner, info, warn } from "@luban-cli/cli-shared-utils";
import { Npm } from "./npm";
import { getPackageJson } from "./share";
import { Reminder } from "./constant";

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
  try {
    await Npm.bumpVersion(version.getNewVersion());
  } catch (err) {
    error(err);
    process.exit(1);
  }

  spin.stopSpinner();

  const rollback = onetime(async () => {
    console.log("\nPublish failed. Rolling back to the previous state…");

    const tagVersionPrefix = await Npm.getTagVersionPrefix();

    const latestTag = await Git.getLatestTag();
    const versionInLatestTag = latestTag.slice(tagVersionPrefix.length);

    try {
      if (
        versionInLatestTag === getPackageJson().version &&
        versionInLatestTag !== pkg.version
      ) {
        // Verify that the package's version has been bumped before deleting the last tag and commit.
        await Git.deleteTag(latestTag);
        await Git.removeLastCommit();
      }

      console.log(
        "Successfully rolled back the project to its previous state.",
      );
    } catch (error) {
      console.log(
        `Couldn't roll back because of the following error:\n${error}`,
      );
    }
  });

  spin.logWithSpinner(`${chalk.bgGreen("Publish")} publish package ... `);

  let hasPublishErr = false;
  let publishStatus = "UNKNOWN";

  await from(Npm.publish(options)).pipe(
    catchError((err) => {
      hasPublishErr = true;

      rollback();

      error(Reminder.npm.pingFailed(err.message));

      process.exit(1);
    }),
    finalize(() => {
      publishStatus = hasPublishErr ? "FAILED" : "SUCCESS";
    }),
  );
  spin.stopSpinner();

  if (publishStatus === "SUCCESS") {
    const hasUpstream = await Git.hasUpstream();
    if (hasUpstream) {
      spin.logWithSpinner(`${chalk.bgGreen("Publish")} push git tag ... `);
      await Git.pushGraceful();
      spin.stopSpinner();
    } else {
      warn("Upstream branch not found; not pushing.");
    }
  }

  if (publishStatus === "FAILED") {
    warn("Couldn't publish package to npm; not pushing.");
  }

  const newPkg = getPackageJson();
  info(`\n ${newPkg.name} ${newPkg.version} published 🎉`);
}
