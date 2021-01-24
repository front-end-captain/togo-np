import { from } from "rxjs";
import onetime from "onetime";
import { catchError, finalize } from "rxjs/operators";
import { error, info } from "@luban-cli/cli-shared-utils";

import { Npm } from "./npm";
import { Git } from "./git";
import { Reminder } from "./constant";
import { getPackageJson } from "./share";

import { CliOptions, BasePkgFields, PublishStatus } from "./definitions";

function rollback(pkg: BasePkgFields) {
  return onetime(async () => {
    info(Reminder.npm.startRollback);

    const tagVersionPrefix = await Npm.getTagVersionPrefix();

    const latestTag = await Git.getLatestTag();
    const versionInLatestTag = latestTag.slice(tagVersionPrefix.length);

    try {
      if (
        versionInLatestTag === getPackageJson().version &&
        versionInLatestTag !== pkg.version
      ) {
        await Git.deleteTag(latestTag);
        await Git.removeLastCommit();
      }

      info(Reminder.npm.rollbackOk);
    } catch (err) {
      error(Reminder.npm.rollbackFail(err));
    }
  });
}

export function publish(
  options: CliOptions,
  pkg: BasePkgFields,
  cb: (status: PublishStatus) => void,
) {
  let hasPublishErr = false;
  let publishStatus: PublishStatus = "UNKNOWN";

  const publishResult = from(Npm.publish(options)).pipe(
    catchError(async (err) => {
      hasPublishErr = true;

      await rollback(pkg);

      throw new Error(Reminder.npm.publishFail(err.message));
    }),
    finalize(() => {
      publishStatus = hasPublishErr ? "FAILED" : "SUCCESS";

      cb(publishStatus);
    }),
  );

  publishResult.subscribe();
}
