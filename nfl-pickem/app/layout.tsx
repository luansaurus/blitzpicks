import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LoadingProvider from "../components/providers/LoadingProvider";
import BackToTop from "../components/ui/BackToTop";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BlitzPicks - NFL Prediction League",
  description: "Make your picks, manage your game and spy on your rivals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A MÁGICA ESTÁ AQUI: suppressHydrationWarning na tag HTML
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              var color = localStorage.getItem('blitz_accent') || '#f59e0b';
              document.documentElement.style.setProperty('--team-accent', color);
            } catch (e) {}
          `
        }} />
      </head>
      <body className={`${inter.className} bg-neutral-950 min-h-screen text-white antialiased`}>
        
        <Suspense fallback={
          <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/10 border-t-amber-500 rounded-full animate-spin" />
          </div>
        }>
          <LoadingProvider>
            {children}
          </LoadingProvider>
        </Suspense>

        <BackToTop />
        
      </body>
    </html>
  );
}