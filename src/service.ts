import { CliOptions } from "./definitions";
import { Version } from "./version";

class Service {
  constructor(version: Version, options: CliOptions) {
    console.log(version, options);
  }

  public run() {
    console.log("run Service");
  }

  private prerequisiteTasks() {
    //
  }
}

export { Service };
