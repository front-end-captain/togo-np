import { ReleaseType } from "semver";

export type PublishStatus = "UNKNOWN" | "SUCCESS" | "FAILED";

export interface CliOptions {
  tag?: string;
  allowAnyBranch?: boolean;
  branch?: string;
  clean?: boolean;
  runScripts?: string;
  version?: ReleaseType | string;
}

/**
 * @description package.json fields, name and version must required
 *
 * @see https://docs.npmjs.com/creating-a-package-json-file
 */
export type BasePkgFields = {
  name: string;
  description?: string;
  version: string;
  main?: string;
  scripts?: Record<string, string>;
  repository?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  keywords?: string[];
  author?: string;
  browserslist?: string[];
  homepage?: string;
  publishConfig?: Record<string, unknown>;
  engines?: Record<string, unknown>;
} & Record<string, unknown>;
