import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "Личная CRM для поиска заведений, ведения контактов и подготовки сообщений в WhatsApp.";

  return {
    metadataBase: new URL(origin),
    title: "LeadPilot KZ — база ресторанов",
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "LeadPilot KZ",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "LeadPilot KZ — база ресторанов" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LeadPilot KZ",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
