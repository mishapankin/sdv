import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { DesktopMenuBar } from "@/components/desktop-menu-bar";
import { QueryProvider } from "@/components/query-provider";
import { readDefaultRepositoryName } from "@/lib/workspace";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  let repositoryName = "repository";

  try {
    repositoryName = await readDefaultRepositoryName();
  } catch {
    // The main view provides the actionable repository error state.
  }

  return {
    title: `SDV: ${repositoryName}`,
    description: "Entity-level diffs for your working tree",
    icons: {
      icon: {
        url: "/favicon.png",
        type: "image/png",
      },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("sdv-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()',
          }}
        />
      </head>
      <body className="min-h-full">
        <QueryProvider>
          <DesktopMenuBar />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
