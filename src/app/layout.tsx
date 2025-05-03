import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed font for a cleaner look
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import { AuthProvider } from '@/context/AuthContext'; // Import AuthProvider

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' }); // Use Inter font

export const metadata: Metadata = {
  title: 'OnlyFly - AI Powered House Swaps',
  description: 'Travel the world spending less with AI-powered house swaps. Find your perfect match and book the cheapest flights.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
         <AuthProvider> {/* Wrap with AuthProvider */}
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
          <Toaster /> {/* Add Toaster component */}
        </AuthProvider>
      </body>
    </html>
  );
}
