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
      <body>{children}</body>
    </html>
  );
}