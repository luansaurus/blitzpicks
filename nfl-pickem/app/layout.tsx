import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google"; // Removemos o Graduate daqui
import "./globals.css";
import LoadingProvider from "../components/providers/LoadingProvider";
import BackToTop from "../components/ui/BackToTop";
import Footer from "../components/ui/Footer";
import { Suspense } from "react";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter", 
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: "BlitzPicks - NFL Prediction League",
  description: "Make your picks, manage your game and spy on your rivals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Removemos a variável do Graduate do className
    <html lang="en" className={`scroll-smooth ${inter.variable} ${oswald.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              var color = localStorage.getItem('blitz_accent') || '#ff2a2a';
              document.documentElement.style.setProperty('--team-accent', color);
            } catch (e) {}
          `
        }} />
      </head>
      <body className="font-sans bg-neutral-950 min-h-screen flex flex-col text-white antialiased">
        <Suspense fallback={
          <div className="flex-grow bg-neutral-950 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/10 border-t-[#ff2a2a] rounded-full animate-spin" />
          </div>
        }>
          <main className="flex-grow">
            <LoadingProvider>
              {children}
            </LoadingProvider>
          </main>
        </Suspense>

        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}