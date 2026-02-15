import type { Metadata } from 'next';
import { Outfit, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-display',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MedLit Agent — Evidence-Based Clinical Decision Support',
  description: 'AI-powered clinical decision support using MedGemma. Multi-model consensus, medical imaging, lab extraction, and evidence synthesis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            className: 'font-sans',
          }}
        />
      </body>
    </html>
  );
}
