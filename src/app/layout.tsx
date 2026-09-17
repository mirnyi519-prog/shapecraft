import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "ShapeCraft — 3D-сувениры",
  description: "Витрина 3D-сувениров ShapeCraft.",
  openGraph: {
    title: "ShapeCraft — 3D-сувениры",
    description: "Витрина 3D-сувениров ShapeCraft.",
    url: "https://shapecraft.ru",
    siteName: "ShapeCraft",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ShapeCraft — 3D-сувениры",
    description: "Витрина 3D-сувениров ShapeCraft.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ed6900",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
