import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerZIP } from "@electron-forge/maker-zip";

import { packageElectron } from "./package-electron.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const result = await packageElectron();
const makeDir = path.join(projectRoot, "out", "make");
const makerOptions = {
  appName: "SDV",
  dir: result.packagedPaths[0],
  forgeConfig: {},
  makeDir,
  packageJSON: packageJson,
  targetArch: result.arch,
  targetPlatform: result.platform,
};
const artifacts = [];

await rm(makeDir, { recursive: true, force: true });

const zipMaker = new MakerZIP();
await zipMaker.prepareConfig(result.arch);
artifacts.push(...(await zipMaker.make(makerOptions)));

if (result.platform === "linux") {
  const debMaker = new MakerDeb({
    options: {
      icon: path.join(projectRoot, "electron", "assets", "icon.png"),
      maintainer: "SDV contributors",
    },
  });

  await debMaker.prepareConfig(result.arch);

  if (
    debMaker.externalBinariesExist() &&
    debMaker.isSupportedOnCurrentPlatform()
  ) {
    artifacts.push(...(await debMaker.make(makerOptions)));
  } else {
    console.warn(
      "Skipped .deb: install dpkg and fakeroot on the Linux build host",
    );
  }
}

for (const artifact of artifacts) {
  console.log(`Created ${artifact}`);
}
