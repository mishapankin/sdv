export {};

declare global {
  interface Window {
    sdvDesktop?: {
      isDesktop: true;
      platform: "darwin" | "linux" | "win32";
      getCurrentRepository(): Promise<{ name: string } | null>;
      getRecentRepositories(): Promise<
        Array<{
          available: boolean;
          lastOpenedAt: string | null;
          name: string;
          path: string;
        }>
      >;
      forgetRepository(path: string): Promise<{ ok: true }>;
      openRepository(): Promise<
        | { ok: true }
        | { ok: false; canceled?: boolean; error?: string }
      >;
      openRecentRepository(path: string): Promise<
        { ok: true } | { ok: false; error: string }
      >;
      getSettingsPath(): Promise<string>;
      copySettingsPath(): Promise<void>;
      getTheme(): Promise<"system" | "light" | "dark">;
      setTheme(theme: "system" | "light" | "dark"): Promise<void>;
      getWindowControls(): Promise<{
        mode: "native" | "left" | "right" | "hidden";
        defaultMode: "native" | "right";
        platform: "darwin" | "linux" | "win32";
      }>;
      setWindowControls(
        mode: "native" | "left" | "right" | "hidden",
      ): Promise<void>;
      windowAction(action: "minimize" | "maximize" | "close"): Promise<void>;
      showMenu(
        menu: "file" | "view" | "window",
        position: { x: number; y: number },
      ): Promise<void>;
    };
  }
}
