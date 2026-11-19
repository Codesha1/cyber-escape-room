import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CYBER ESCAPE ROOM | مهمة إنقاذ مختبر البرمجة',
  description: 'لعبة تعليمية تفاعلية عن التكرارات في سكراتش — الصف الرابع الابتدائي',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05040f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Orbitron:wght@600;800;900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
