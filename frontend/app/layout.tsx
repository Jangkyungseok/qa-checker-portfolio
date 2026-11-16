import { Suspense } from 'react';
import DevRouteGuard from './components/DevRouteGuard';
import './globals.css';

export const metadata = {
  title: 'QA Checker',
  description: 'Game QA process and inspection management tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body><Suspense fallback={<main className="execution-loading">불러오는 중...</main>}><DevRouteGuard>{children}</DevRouteGuard></Suspense></body>
    </html>
  );
}