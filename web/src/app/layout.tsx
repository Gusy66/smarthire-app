import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import AuthSessionSync from "@/components/AuthSessionSync";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartHire - Recrutamento Inteligente",
  description: "Plataforma de recrutamento e seleção com inteligência artificial",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]`}
      >
        <AuthSessionSync />
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
