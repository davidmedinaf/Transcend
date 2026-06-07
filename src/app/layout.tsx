import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Transcend Health Mallorca",
  description: "Wellness booking platform by Transcend Health Mallorca",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Transcend",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${playfairDisplay.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* iOS-specific meta tags for PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Transcend" />
        <link
          rel="apple-touch-icon"
          href="/icons/apple-touch-icon.png"
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
