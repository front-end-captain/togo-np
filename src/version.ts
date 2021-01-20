import { CliOptions } from "./definitions";

class Version {
  private inputVersion: string;
  private options: CliOptions;

  constructor(version: string, options: CliOptions) {
    this.inputVersion = version;
    this.options = options;
  }
}

export { Version };
