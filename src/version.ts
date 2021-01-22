import inquirer from "inquirer";
import Semver from "semver";
import chalk from "chalk";
import { error } from "@luban-cli/cli-shared-utils";

import { getPackageJson } from "./share";
import { BasePkgFields } from "./definitions";
import { Reminder, SEMVER_INCREMENTS } from "./constant";

class Version {
  private inputVersion: Semver.ReleaseType | string;
  private nextVersion: string;
  private currentVersion: string;

  constructor(inputVersion: Semver.ReleaseType | string) {
    this.inputVersion = inputVersion;

    this.currentVersion = getPackageJson().version;

    this.nextVersion = "";
  }

  static isValidVersion(input: Semver.SemVer | string) {
    return Boolean(Semver.valid(input));
  }

  static isSemverIncrementVersion(input: string) {
    return SEMVER_INCREMENTS.includes(input);
  }

  static isValidInputVersion(input: string) {
    return (
      Version.isSemverIncrementVersion(input) || Version.isValidVersion(input)
    );
  }

  static getNewVersionFrom(
    from: string | Semver.SemVer,
    input: Semver.ReleaseType,
    identifier?: string,
  ) {
    Version.validate(from);

    Version.validateInputVersion(input);

    return SEMVER_INCREMENTS.includes(input)
      ? Semver.inc(from, input, identifier)
      : input;
  }

  static validateInputVersion(input: string) {
    if (!Version.isValidInputVersion(input)) {
      error(Reminder.version.invalidInputVersion);
      process.exit(1);
    }
  }

  /**
   * validate input is a valid semver version
   *
   * @param input version
   * @throws Error
   */
  static validate(input: Semver.SemVer | string) {
    if (!Version.isValidVersion(input)) {
      error(Reminder.version.invalidVersion);
      process.exit(1);
    }
  }

  static isLowerThanOrEqualTo(
    version: Semver.SemVer | string,
    nextVersion: Semver.SemVer | string,
  ) {
    Version.validate(version);
    Version.validate(nextVersion);
    return Semver.lte(version, nextVersion);
  }

  static prettyVersionDiff(oldVersion: string, inc: Semver.ReleaseType) {
    const newVersion = Version.getNewVersionFrom(oldVersion, inc);
    if (!newVersion) {
      return "";
    }

    const _newVersion = newVersion.split(".");
    const _oldVersion = oldVersion.split(".");

    let firstVersionChange = false;
    const output = [];

    for (const [i, element] of _newVersion.entries()) {
      if (element !== _oldVersion[i] && !firstVersionChange) {
        output.push(`${chalk.dim.cyan(element)}`);
        firstVersionChange = true;
      } else if (element.indexOf("-") >= 1) {
        let preVersion = [];
        preVersion = element.split("-");
        output.push(`${chalk.dim.cyan(`${preVersion[0]}-${preVersion[1]}`)}`);
      } else {
        output.push(chalk.reset.dim(element));
      }
    }

    return output.join(chalk.reset.dim("."));
  }

  public async prepare() {
    const inputVersion = this.inputVersion;

    if (Version.isSemverIncrementVersion(inputVersion)) {
      const _nextVersion = Version.getNewVersionFrom(
        this.currentVersion,
        inputVersion as Semver.ReleaseType,
      );

      if (_nextVersion) {
        this.nextVersion = _nextVersion;
        return;
      }
    }

    if (Version.isValidVersion(inputVersion)) {
      if (Version.isLowerThanOrEqualTo(inputVersion, this.currentVersion)) {
        error(
          Reminder.version.lowerThanOrEqualTo(
            inputVersion,
            this.currentVersion,
          ),
        );
        process.exit(1);
      }

      this.nextVersion = inputVersion;
      return;
    }

    if (inputVersion) {
      if (!Version.isValidVersion(inputVersion)) {
        error(Reminder.version.invalidVersion);
        process.exit(1);
      }
    }

    const answer = await inquirer.prompt<{
      version?: string;
      customVersion?: string;
    }>([
      {
        type: "list",
        name: "version",
        message: "Select semver increment or specify new version",
        pageSize: SEMVER_INCREMENTS.length + 2,
        choices: SEMVER_INCREMENTS.map((inc) => ({
          name: `${inc} ${Version.prettyVersionDiff(
            this.currentVersion,
            inc as Semver.ReleaseType,
          )}`,
          value: inc,
        })).concat([
          // @ts-ignore
          new inquirer.Separator(),
          {
            name: "Other (specify)",
            value: "",
          },
        ]),
        filter: (input) =>
          Version.isValidInputVersion(input)
            ? Version.getNewVersionFrom(this.currentVersion, input)
            : input,
      },
      {
        type: "input",
        name: "customVersion",
        message: "Version",
        when: (answers) => !answers.version,
        filter: (input) =>
          Version.isValidInputVersion(input)
            ? Version.getNewVersionFrom(this.currentVersion, input)
            : input,
        validate: (input) => {
          if (!Version.isValidInputVersion(input)) {
            return Reminder.version.invalidVersion;
          }

          if (Version.isLowerThanOrEqualTo(input, this.currentVersion)) {
            return Reminder.version.lowerThanOrEqualTo(
              input,
              this.currentVersion,
            );
          }

          return true;
        },
      },
    ]);

    const _newVersion = (answer.version || answer.customVersion) as string;

    this.nextVersion = _newVersion;
  }

  public getNewVersion() {
    return this.nextVersion;
  }

  public isPrereleaseVersionOfNewVersion() {
    return Semver.prerelease(this.nextVersion);
  }

  public getCurrentVersion() {
    return this.currentVersion;
  }

  static verifyRequirementSatisfied(
    dependency: string,
    version: string,
    pkg: BasePkgFields,
  ) {
    Version.validate(version);

    if (pkg.engines) {
      const depRange = pkg.engines[dependency];

      if (typeof depRange === "string") {
        if (!Semver.satisfies(version, depRange, { includePrerelease: true })) {
          error(Reminder.version.shouldUpgradeDependency(dependency, depRange));
          process.exit(1);
        }
      }
    }
  }
}

export { Version };
