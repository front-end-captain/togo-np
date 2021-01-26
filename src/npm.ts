import execa from "execa";
import pTimeout from "p-timeout";
import validatePkgName from "validate-npm-package-name";
import chalk from "chalk";
import pMemoize from "p-memoize";
import fs from "fs-extra";
import path from "path";

import { BasePkgFields, CliOptions } from "./definitions";

import { Version } from "./version";
import { Reminder } from "./constant";

class Npm {
  private version: Version;
  private options: CliOptions;
  private pkg: BasePkgFields;

  constructor(version: Version, pkg: BasePkgFields, options: CliOptions) {
    this.version = version;
    this.options = options;

    this.pkg = pkg;
  }

  public async prepare() {
    if (this.version.isPrereleaseVersionOfNewVersion()) {
      if (!this.pkg.private && !this.options.tag) {
        throw new Error(Reminder.npm.shouldSpecifyTag);
      }
    }

    Npm.isPackageNameAvailable(this.pkg);

    await Npm.checkConnection();

    await Npm.verifyNpmVersion(this.pkg);

    await this.verifyUserIsAuthenticated();
  }

  static npm(args: readonly string[], options?: execa.Options) {
    return execa("npm", args, options);
  }

  static async getRegistryUrl(pkg: BasePkgFields) {
    const args = ["config", "get", "registry"];

    const registry = Npm.getPackageJsonRegistry(pkg);
    if (registry) {
      args.push("--registry");
      args.push(registry);
    }

    const { stdout } = await Npm.npm(args);
    return stdout;
  }

  static isExternalRegistry(pkg: BasePkgFields) {
    return (
      typeof pkg.publishConfig === "object" &&
      typeof pkg.publishConfig.registry === "string"
    );
  }

  static getPackageJsonRegistry(pkg: BasePkgFields) {
    if (Npm.isExternalRegistry(pkg)) {
      return pkg.publishConfig?.registry as string;
    }

    return undefined;
  }

  static async checkConnection() {
    const configRegistry = await Npm.getConfigRegistry();

    const errMsg = Reminder.npm.pingFailed(configRegistry);
    const err = new Error(errMsg);

    try {
      await pTimeout(
        (async () => {
          try {
            await Npm.npm(["ping"]);
            return true;
          } catch {
            throw err;
          }
        })(),
        15000,
        errMsg,
      );
    } catch (ignoreError) {
      throw err;
    }
  }

  static async getVersion() {
    const { stdout } = await Npm.npm(["--version"]);
    return stdout;
  }

  static async verifyNpmVersion(pkg: BasePkgFields) {
    const npmVersion = await Npm.getVersion();

    Version.verifyRequirementSatisfied("npm", npmVersion, pkg);
  }

  static async username(externalRegistry?: string) {
    const args = ["whoami"];

    if (externalRegistry) {
      args.push("--registry", externalRegistry);
    }

    try {
      const { stdout } = await Npm.npm(args);
      return stdout;
    } catch (error) {
      const err = /ENEEDAUTH/.test(error.stderr)
        ? Reminder.npm.unLogin
        : Reminder.npm.unAuth;

      throw new Error(err);
    }
  }

  static async collaborators(pkg: BasePkgFields) {
    const args = ["access", "ls-collaborators", pkg.name];
    const registry = Npm.getPackageJsonRegistry(pkg);

    if (registry) {
      args.push("--registry", registry);
    }

    try {
      const { stdout } = await Npm.npm(args);
      return stdout;
    } catch (err) {
      // Ignore non-existing package error
      if (
        err.stderr.includes("code E404") ||
        err.stderr.includes("code ENOTFOUND")
      ) {
        return false;
      }

      throw new Error(err);
    }
  }

  private async verifyUserIsAuthenticated() {
    const username = await Npm.username(Npm.getPackageJsonRegistry(this.pkg));

    const collaborators = await Npm.collaborators(this.pkg);
    if (!collaborators) {
      return;
    }

    const json = JSON.parse(collaborators);
    const permissions = json[username];

    if (!permissions || !permissions.includes("write")) {
      throw new Error(Reminder.npm.unPublishPermission);
    }
  }

  /**
   *
   * @param pkg
   * @throws Error
   */
  static isPackageNameAvailable(pkg: BasePkgFields) {
    const result = validatePkgName(pkg.name);

    if (!result.validForNewPackages) {
      result.errors &&
        result.errors.forEach((err) => {
          console.error(chalk.red.dim("Error: " + err));
        });
      result.warnings &&
        result.warnings.forEach((warn) => {
          console.error(chalk.red.dim("Warning: " + warn));
        });

      throw new Error(`Invalid package name: "${pkg.name}"`);
    }
  }

  static async getConfigRegistry() {
    const { stdout } = await Npm.npm(["config", "get", "registry"]);
    return stdout;
  }

  static getTagVersionPrefix = pMemoize(async () => {
    try {
      const { stdout } = await Npm.npm(["config", "get", "tag-version-prefix"]);
      return stdout;
    } catch {
      return "v";
    }
  });

  static async installDependency() {
    const rootDir = process.cwd();

    const hasLockFile =
      fs.existsSync(path.resolve(rootDir, "package-lock.json")) ||
      fs.existsSync(path.resolve(rootDir, "npm-shrinkwrap.json"));

    const args = hasLockFile
      ? ["ci"]
      : ["install", "--no-package-lock", "--no-production"];

    return Npm.npm([...args, "--engine-strict"]);
  }

  static async runSpecifyScript(script: string) {
    return Npm.npm(["run", script]);
  }

  static bumpVersion(input: string) {
    return Npm.npm(["version", input]);
  }

  static publish(options: CliOptions) {
    const args = ["publish"];
    if (options.tag) {
      args.push("--tag", options.tag);
    }

    return Npm.npm(args);
  }
}

export { Npm };
