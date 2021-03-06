#!/usr/bin/env node

'use strict';

var semver = require("semver");
var requiredVersion = require("../package.json").engines.node;

if (!semver.satisfies(process.version, requiredVersion)) {
  console.error(
    `You are using Node ${process.version}, but togo ` +
      `requires Node ${requiredVersion}.\nPlease upgrade your Node version.`,
  );
  process.exit(1);
}

require("./../lib/cli");
