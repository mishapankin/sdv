export {};

declare global {
  interface Window {
    sdvDesktop?: {
      isDesktop: true;
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
    };
  }
}
