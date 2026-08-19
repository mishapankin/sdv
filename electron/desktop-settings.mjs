export const THEME_MODES = new Set(["system", "light", "dark"]);
export const WINDOW_CONTROL_MODES = new Set([
  "native",
  "left",
  "right",
  "hidden",
]);

export function getDefaultWindowControls(platform) {
  return platform === "win32" ? "right" : "native";
}

export function getDefaultDesktopSettings(platform) {
  return {
    theme: "system",
    windowControls: getDefaultWindowControls(platform),
  };
}

export function parseDesktopSettings(value, platform) {
  const defaults = getDefaultDesktopSettings(platform);

  if (!value || typeof value !== "object") return defaults;

  return {
    theme: THEME_MODES.has(value.theme) ? value.theme : defaults.theme,
    windowControls:
      platform !== "darwin" && WINDOW_CONTROL_MODES.has(value.windowControls)
        ? value.windowControls
        : defaults.windowControls,
  };
}

export function serializeDesktopSettings(settings) {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
