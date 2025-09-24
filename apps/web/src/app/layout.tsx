import type { Metadata } from 'next';

import AppProviders from '@/providers/AppProviders';

import 'antd/dist/reset.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plataforma de afiliados Medipiel',
  description:
    'Panel de gestión de afiliados, campañas, comisiones y pagos para el ecosistema Medipiel.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
