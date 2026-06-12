import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import { ServerProvider } from '@/context/ServerContext';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'Redfish Emulator GUI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ThemeRegistry>
          <ServerProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ServerProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
