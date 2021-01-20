import { ReleaseType } from "semver";

export interface CliOptions {
  tag: string;
  allowAnyBranch: boolean;
  branch: string;
  clean: boolean;
  runScripts: string[];
  version: ReleaseType | string;
}
