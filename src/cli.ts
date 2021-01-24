import { Command, Option } from "commander";
import dedent from "dedent";
import { error, info, log } from "@luban-cli/cli-shared-utils";
import { CliOptions } from "./definitions";

import { run } from "./run";

function camelize(str: string): string {
  return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ""));
}

function prepareOptions<T>(cmd: Command) {
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
  .option(
    "--run-scripts <scripts>",
    "run specify script, for example, --run-scripts 'test build'",
  )
  .option("--clean", "remove 'node_modules' and reinstall, default 'false'")
  .action(async (inputVersion: undefined | string, cmd: Command) => {
    const options = prepareOptions<CliOptions>(cmd);

    try {
      await run(inputVersion, options);
    } catch (err) {
      error(err.message);

      console.log();

      info("Publish exception, Exit.");
      process.exit(1);
    }
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
