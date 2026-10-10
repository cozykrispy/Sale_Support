import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Support Hub | Fusion Advantec",
  description:
    "AI-powered product search, model-aware recommendations, and portfolio management—built for fast, customer-ready answers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#ebf1fd] text-slate-900 antialiased selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
