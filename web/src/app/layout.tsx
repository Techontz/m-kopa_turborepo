import type { Metadata } from "next";
import { Source_Sans_3, Ubuntu } from "next/font/google";

import "bootstrap/dist/css/bootstrap.min.css";
import "simple-line-icons/css/simple-line-icons.css";
import "font-awesome/css/font-awesome.min.css";
import "@/styles/tokens.css";
import "@/styles/theme.css";
import "@/styles/theme-components.css";
import "@/styles/app.css";

import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-source-sans" });
const ubuntu = Ubuntu({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-ubuntu" });

export const metadata: Metadata = {
  title: "MIKOPOFASTA | Admin",
  description: "MikopoFasta microfinance management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" className={`${sourceSans.variable} ${ubuntu.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
