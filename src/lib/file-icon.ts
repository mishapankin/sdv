import type { FileIconName } from "@/components/file-icon-data.generated";

const exactFileIcons: Record<string, FileIconName> = {
  ".dockerignore": "file-type-docker",
  ".gitattributes": "file-type-git",
  ".gitignore": "file-type-git",
  ".gitmodules": "file-type-git",
  "agents.md": "file-type-agents",
  "bun.lock": "file-type-bun",
  "bun.lockb": "file-type-bun",
  "cargo.lock": "file-type-cargo",
  "cargo.toml": "file-type-cargo",
  "dockerfile": "file-type-docker",
  "go.mod": "file-type-go",
  "go.sum": "file-type-go",
  "package-lock.json": "file-type-npm",
  "package.json": "file-type-npm",
  "pnpm-lock.yaml": "file-type-pnpm",
  "pnpm-workspace.yaml": "file-type-pnpm",
  "yarn.lock": "file-type-yarn",
};

const extensionIcons: Record<string, FileIconName> = {
  astro: "file-type-astro",
  avi: "file-type-video",
  bash: "file-type-shell",
  bin: "file-type-binary",
  bmp: "file-type-image",
  c: "file-type-c",
  cc: "file-type-cpp",
  cpp: "file-type-cpp",
  cs: "file-type-csharp",
  css: "file-type-css",
  dart: "file-type-dartlang",
  eex: "file-type-elixir",
  elm: "file-type-elm",
  erb: "file-type-ruby",
  erl: "file-type-erlang",
  ex: "file-type-elixir",
  exs: "file-type-elixir",
  fish: "file-type-shell",
  flac: "file-type-audio",
  gif: "file-type-image",
  go: "file-type-go",
  gql: "file-type-graphql",
  graphql: "file-type-graphql",
  gz: "file-type-zip",
  h: "file-type-cheader",
  hpp: "file-type-cppheader",
  hs: "file-type-haskell",
  htm: "file-type-html",
  html: "file-type-html",
  java: "file-type-java",
  jpeg: "file-type-image",
  jpg: "file-type-image",
  js: "file-type-js-official",
  cjs: "file-type-js-official",
  json: "file-type-json-official",
  jsonc: "file-type-json-official",
  jsx: "file-type-reactjs",
  kt: "file-type-kotlin",
  kts: "file-type-kotlin",
  less: "file-type-less",
  lock: "file-type-config",
  lua: "file-type-lua",
  m4a: "file-type-audio",
  md: "file-type-markdown",
  mdx: "file-type-mdx",
  mjs: "file-type-js-official",
  mts: "file-type-typescript-official",
  mov: "file-type-video",
  mp3: "file-type-audio",
  mp4: "file-type-video",
  pdf: "file-type-pdf2",
  php: "file-type-php",
  png: "file-type-image",
  prisma: "file-type-prisma",
  proto: "file-type-protobuf",
  py: "file-type-python",
  r: "file-type-r",
  rb: "file-type-ruby",
  rs: "file-type-rust",
  sass: "file-type-sass",
  scala: "file-type-scala",
  scss: "file-type-scss",
  sh: "file-type-shell",
  sol: "file-type-solidity",
  sql: "file-type-sql",
  svelte: "file-type-svelte",
  svg: "file-type-image",
  swift: "file-type-swift",
  tar: "file-type-zip",
  toml: "file-type-toml",
  ts: "file-type-typescript-official",
  cts: "file-type-typescript-official",
  tsx: "file-type-reactts",
  ttf: "file-type-font",
  vue: "file-type-vue",
  wav: "file-type-audio",
  webm: "file-type-video",
  webp: "file-type-image",
  woff: "file-type-font",
  woff2: "file-type-font",
  xml: "file-type-xml",
  yaml: "file-type-yaml-official",
  yml: "file-type-yaml-official",
  zip: "file-type-zip",
  zsh: "file-type-shell",
};

export function getFileIconName(filePath: string): FileIconName | undefined {
  const fileName = filePath.split("/").at(-1)?.toLowerCase() ?? filePath;
  const exactIcon = exactFileIcons[fileName];

  if (exactIcon) return exactIcon;
  if (/^readme(?:\.|$)/.test(fileName)) return "file-type-markdown";
  if (/^(license|licence)(?:\.|$)/.test(fileName)) return "file-type-license";
  if (/^dockerfile(?:\.|$)/.test(fileName)) return "file-type-docker";
  if (/^(docker-)?compose\.(yaml|yml)$/.test(fileName)) {
    return "file-type-docker";
  }
  if (/^tsconfig(?:\..+)?\.json$/.test(fileName)) {
    return "file-type-typescript-official";
  }
  if (/^jsconfig(?:\..+)?\.json$/.test(fileName)) {
    return "file-type-js-official";
  }
  if (/^next\.config\./.test(fileName)) return "file-type-next";
  if (/^vite\.config\./.test(fileName)) return "file-type-vite";
  if (/^vitest\.config\./.test(fileName)) return "file-type-vitest";
  if (/^tailwind\.config\./.test(fileName)) return "file-type-tailwind";
  if (/^(eslint\.config\.|\.eslintrc)/.test(fileName)) {
    return "file-type-eslint";
  }
  if (/^(prettier\.config\.|\.prettierrc)/.test(fileName)) {
    return "file-type-prettier";
  }
  if (/^\.env(?:\.|$)/.test(fileName)) return "file-type-config";
  if (/\.d\.(ts|mts|cts)$/.test(fileName)) {
    return "file-type-typescriptdef-official";
  }

  const extension = fileName.includes(".")
    ? fileName.split(".").at(-1)
    : undefined;

  return extension ? extensionIcons[extension] : undefined;
}
