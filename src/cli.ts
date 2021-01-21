import { Command, Option } from "commander";
import dedent from "dedent";
import { log } from "@luban-cli/cli-shared-utils";
import { CliOptions } from "./definitions";

import { run } from "./run";

function camelize(str: string): string {
  return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ""));
}

function prepareInitOptions<T>(cmd: Command) {
  const args = {} as Record<string, any>;

  (cmd.options as Array<Option>).forEach((o) => {
    const key = camelize(o.long.replace(/^--/, ""));
    if (typeof cmd[key] !== "function" && typeof cmd[key] !== "undefined") {
      args[key] = cmd[key];
    }
  });

  return args as T;
}

const program = new Command();

program
  // eslint-disable-next-line import/no-commonjs
  .version(`togo-np ${require("../package.json").version}`);

program
  .arguments("[version]")
  .option("--tag <tag>", "specify dist-tag, default 'latest'")
  .option("--allow-any-branch", " any branch can publish, default 'false'")
  .option("--branch <branch>", "specify branch that allow publish")
  .option("--run-scripts <scripts>", "run specify script")
  .option(
    "--clean",
    "remove 'node_modules' and reinstall before publish, default 'false'",
  )
  .action((inputVersion: undefined | string, cmd: Command) => {
    const options = prepareInitOptions<CliOptions>(cmd);

    run(inputVersion, options);
  });

program.on("--help", () => {
  log();
  log(
    `\n${dedent`
      # Usage
        Check version: togo-np version
        Help: togo help

      # GitHub
        https://github.com/front-end-captain/todo-np#readme
    `}\n`,
  );
});

program.parse(process.argv);
