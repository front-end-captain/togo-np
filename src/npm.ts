import { error } from "@luban-cli/cli-shared-utils";
import execa from "execa";
import pTimeout from "p-timeout";
import { BasePkgFields, CliOptions } from "./definitions";
import { Version } from "./version";

class Npm {
  private version: Version;
  private options: CliOptions;
  private pkg: BasePkgFields;

  constructor(version: Version, _options: CliOptions, pkg: BasePkgFields) {
    this.version = version;
    this.options = _options;

    this.pkg = pkg;
  }

  public async prepare() {
    if (this.version.isPrereleaseVersionOfNewVersion()) {
      if (!this.pkg.private && !this.options.tag) {
        error(
          "You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as 'latest'. https://docs.npmjs.com/cli/dist-tag'",
        );
        process.exit(1);
      }
    }

    await Npm.checkConnection();

    await Npm.verifyRecentNpmVersion(this.pkg);

    // TODO
    // 1. 检查 npm 服务连接情况
    // 2. 检查 npm 版本是否符合package运行要求
    // 3. 检查用户是否是 package的collaborator且具有写权限
  }

  static npm(args: readonly string[], options?: execa.Options) {
    return execa("npm", args, options);
  }

  static async getRegistryUrl(pkg: BasePkgFields) {
    const args = ["config", "get", "registry"];

    if (Npm.isExternalRegistry(pkg)) {
      args.push("--registry");
      args.push(pkg.publishConfig?.registry as string);
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

  static async checkConnection() {
    await pTimeout(
      (async () => {
        try {
          await Npm.npm(["ping"]);
          return true;
        } catch {
          throw new Error("Connection to npm registry failed");
        }
      })(),
      15000,
      "Connection to npm registry timed out",
    );
  }

  static async getVersion() {
    const { stdout } = await Npm.npm(["--version"]);
    return stdout;
  }

  static async verifyRecentNpmVersion(pkg: BasePkgFields) {
    const npmVersion = await Npm.getVersion();

    Version.verifyRequirementSatisfied("npm", npmVersion, pkg);
  }

  static async username(externalRegistry: string) {
    const args = ["whoami"];

    if (externalRegistry) {
      args.push("--registry", externalRegistry);
    }

    try {
      const { stdout } = await Npm.npm(args);
      return stdout;
    } catch (error) {
      const err = /ENEEDAUTH/.test(error.stderr)
        ? "You must be logged in. Use `npm login` and try again."
        : "Authentication error. Use `npm whoami` to troubleshoot.";

      error(err);
      process.exit(1);
    }
  }

  static async collaborators(pkg: BasePkgFields) {
    const args = ["access", "ls-collaborators", pkg.name];

    if (Npm.isExternalRegistry(pkg)) {
      args.push("--registry", pkg.publishConfig?.registry as string);
    }

    try {
      const { stdout } = await Npm.npm(args);
      return stdout;
    } catch (err) {
      // Ignore non-existing package error
      if (err.stderr.includes("code E404")) {
        return false;
      }

      error(err);
      process.exit(1);
    }
  }
}

export { Npm };
