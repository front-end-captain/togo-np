import { done, warn } from "@luban-cli/cli-shared-utils";

import { BasePkgFields } from "./definitions";

import { Npm } from "./npm";

export async function runScripts(input: string, pkg: BasePkgFields) {
  const scripts = input.split(" ");

  const allScripts = Object.keys(pkg.scripts || {});

  const availableScripts = scripts.filter((s) => allScripts.includes(s));

  if (availableScripts.length > 0) {
    await Promise.all(
      availableScripts.map(async (script) => {
        return new Promise((resolve) => {
          Npm.runSpecifyScript(script)
            .then(({ stdout, stderr }) => {
              console.log(stdout);
              console.log(stderr);
              resolve(undefined);
              done(script, "Run");
            })
            .catch((err) => {
              console.log(err.stdout);
              console.log(err.stderr);
              throw new Error(`Run scripts '${script}' exception.`);
            });
        });
      }),
    );
  } else {
    warn(
      "There are no runnable scripts. Please check you specified option '--run-scripts'",
    );
  }
}
