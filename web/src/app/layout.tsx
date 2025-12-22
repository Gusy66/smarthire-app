import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import Sidebar from "@/components/Sidebar";
import NavBar from "@/components/NavBar";
import AuthSessionSync from "@/components/AuthSessionSync";

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
          {/* NavBar para mobile e tablet */}
          <div className="lg:hidden">
            <NavBar />
          </div>
          
          {/* Layout com Sidebar (desktop) + Main */}
          <div className="flex min-h-screen bg-[hsl(var(--background))]">
            <Sidebar />
            <main className="flex-1 w-full min-w-0 px-4 py-6 pt-20 sm:px-6 lg:ml-64 lg:px-8 lg:py-8 lg:pt-8 xl:px-12 bg-transparent">
              <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
                {children}
              </div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
