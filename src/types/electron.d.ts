export {};

declare global {
  interface Window {
    sdvDesktop?: {
      isDesktop: true;
      getCurrentRepository(): Promise<{ name: string } | null>;
      openRepository(): Promise<
        | { ok: true }
        | { ok: false; canceled?: boolean; error?: string }
      >;
    };
  }
}
