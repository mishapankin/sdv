import { access, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  flipFuses,
  FuseV1Options,
  FuseVersion,
} from "@electron/fuses";
import { packager } from "@electron/packager";

const projectRoot = path.resolve(import.meta.dirname, "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;

function getExecutablePath(packagedPath, platform) {
  if (platform === "darwin") {
    return path.join(
      packagedPath,
      "SDV.app",
      "Contents",
      "MacOS",
      "sdv",
    );
  }

  return path.join(packagedPath, "sdv");
}

export async function packageElectron({
  arch = process.arch,
  platform = process.platform,
  outDir = path.join(projectRoot, "out"),
} = {}) {
  await access(path.join(standaloneRoot, "server.js"));
  await rm(outDir, { recursive: true, force: true });

  const packagedPaths = await packager({
    appBundleId: "dev.sdv.app",
    arch,
    asar: true,
    dir: projectRoot,
    electronVersion,
    executableName: "sdv",
    extraResource: [standaloneRoot],
    icon:
      platform === "darwin"
        ? path.join(projectRoot, "electron", "assets", "icon.icns")
        : path.join(projectRoot, "electron", "assets", "icon.png"),
    ignore: [/^\/(?!(electron|runtime)(\/|$)|package\.json$)/],
    name: "SDV",
    out: outDir,
    overwrite: true,
    platform,
  });

  for (const packagedPath of packagedPaths) {
    await flipFuses(getExecutablePath(packagedPath, platform), {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      // The trusted, CSP-restricted workspace launcher is loaded from app.asar
      // through file://. Disable this only after migrating it to a custom
      // protocol.
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
      [FuseV1Options.WasmTrapHandlers]: true,
    });
  }

  return {
    arch,
    packagedPaths,
    platform,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await packageElectron();

  for (const packagedPath of result.packagedPaths) {
    console.log(`Packaged ${packagedPath}`);
  }
}
