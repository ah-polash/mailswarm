import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { BrandFavicon } from "@/components/layout/brand-favicon";
import { PlaceholderShortcut } from "@/components/layout/placeholder-shortcut";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bPlugins - Email Marketing Platform",
  description: "Open source email marketing and newsletter platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
        <BrandFavicon />
        <PlaceholderShortcut />
      </body>
    </html>
  );
}
