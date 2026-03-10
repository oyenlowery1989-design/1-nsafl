import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import TelegramGuard from "@/components/guards/TelegramGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";

export const metadata: Metadata = {
  title: "The Homecoming Hub",
  description: "NSAFL — The Homecoming Hub Telegram Mini App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document,l=d.createElement('div');l.id='app-loader';l.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0A0E1A';var s=d.createElement('div');s.style.cssText='width:48px;height:48px;border:3px solid rgba(212,175,55,0.2);border-top-color:#D4AF37;border-radius:50%;animation:loader-spin .8s linear infinite';l.appendChild(s);var st=d.createElement('style');st.textContent='@keyframes loader-spin{to{transform:rotate(360deg)}}';l.appendChild(st);d.currentScript.after(l)})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ErrorBoundary>
          <TelegramGuard>{children}</TelegramGuard>
        </ErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
