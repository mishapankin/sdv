export const WINDOW_CONTROL_MODES = new Set([
  "native",
  "left",
  "right",
  "hidden",
]);

export function getDefaultWindowControls(platform) {
  return platform === "win32" ? "right" : "native";
}

export function parseWindowControls(value, platform) {
  if (platform === "darwin") return "native";

  return WINDOW_CONTROL_MODES.has(value)
    ? value
    : getDefaultWindowControls(platform);
}
