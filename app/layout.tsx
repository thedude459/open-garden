import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { OfflineBanner } from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: "Garden Plant Catalog",
  description: "Search and browse the garden plant database",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
