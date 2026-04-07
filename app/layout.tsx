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
};

export const metadata: Metadata = {
  title: "Bamakor - Property Management Dashboard",
  description: "Professional property and project management platform with real-time ticket tracking, worker assignment, and WhatsApp integration",
  applicationName: "Bamakor",
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
    icon: "/icon.png",
    apple: "/apple-icon.png",
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
      },
    ],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
