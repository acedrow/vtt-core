#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { contentPackageRoot } from "./content-package-root.mjs";

const setup = join(contentPackageRoot(), "rulebook", "setup.sh");
const result = spawnSync("bash", [setup], { stdio: "inherit" });
process.exit(result.status ?? 1);
