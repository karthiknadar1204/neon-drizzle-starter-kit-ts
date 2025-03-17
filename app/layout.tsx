import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs';
import "./globals.css";
import Link from "next/link";
import AuthCallback from "@/components/auth/auth-callback";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF Study Tools",
  description: "Chat with PDFs, create flashcards, and generate summaries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <header className="border-b">
            <div className="container mx-auto py-4 px-4 flex items-center justify-between">
              <Link href="/" className="font-bold text-xl">
                PDF Study
              </Link>
              <nav className="flex items-center gap-6">
                <Link href="/chat-with-pdf" className="text-sm font-medium hover:text-primary">
                  Chat with PDF
                </Link>
                <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary">
                  Flashcards
                </Link>
                <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary">
                  Summaries
                </Link>
                <div className="ml-4">
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Sign In
                      </button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                </div>
              </nav>
            </div>
          </header>
          <main>
            <SignedIn>
              <AuthCallback />
            </SignedIn>
            <NextSSRPlugin
              routerConfig={extractRouterConfig(ourFileRouter)}
            />
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
