import { CliOptions } from "./definitions";

export const defaultCliOptions: CliOptions = {
  tag: "latest",
  branch: "main",
  allowAnyBranch: false,
  clean: false,
  runScripts: [],
  version: "patch",
};
