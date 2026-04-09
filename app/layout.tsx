import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#C41E3A",
  colorScheme: "light dark",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Bamakor - Property Management Dashboard",
  description: "Professional property and project management platform with real-time ticket tracking, worker assignment, and WhatsApp integration",
  applicationName: "Bamakor",
  keywords: ["property management", "maintenance", "tickets", "project management", "real-time"],
  authors: [{ name: "Yoni Levy" }],
  creator: "Yoni Levy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bamakor",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bamakor.vercel.app",
    siteName: "Bamakor",
    title: "Bamakor - Property Management Dashboard",
    description: "Professional property and project management platform",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Bamakor Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bamakor - Property Management Dashboard",
    description: "Professional property and project management platform",
    images: ["/icon.png"],
  },
  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-screen antialiased overflow-hidden`}
    >
      <body className="h-screen overflow-hidden flex flex-col">{children}</body>
    </html>
  );
}
