import './globals.css';
import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n/context';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { RegisterSW } from '@/components/pwa/register-sw';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'AtelierPro — La plateforme B2B2C de l\'automobile en Suisse',
  description: 'Connectez conducteurs et garages. Rendez-vous en ligne, factures TVA 8.1%, gestion de stock, paiements Twint. Fait pour le marché suisse.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AtelierPro',
  },
  icons: {
    icon: '/icon-192.webp',
    apple: '/icon-192.webp',
  },
};

export const viewport = {
  themeColor: '#0f1116',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#0f1116" />
      </head>
      <body className={`${inter.variable} ${jakarta.variable} font-sans`}>
        <AuthProvider>
          <I18nProvider>
            {children}
            <Toaster />
            <SonnerToaster />
            <RegisterSW />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
