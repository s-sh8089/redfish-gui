'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { setApiBase } from '@/lib/api';

export type ServerType = 'emu' | 'ras-emu';

export type Server = {
  label: string;
  host: string;
  port: string;
  type: ServerType;
};

export const SERVERS: Server[] = [
  {
    label: 'BMC',
    host: process.env.NEXT_PUBLIC_EMU_HOST ?? 'localhost',
    port: process.env.NEXT_PUBLIC_EMU_PORT ?? '8008',
    type: 'emu',
  },
  {
    label: 'RAS',
    host: process.env.NEXT_PUBLIC_RAS_EMU_HOST ?? 'localhost',
    port: process.env.NEXT_PUBLIC_RAS_EMU_PORT ?? '8009',
    type: 'ras-emu',
  },
];

type ServerContextValue = {
  current: Server;
  setCurrent: (s: Server) => void;
};

const ServerContext = createContext<ServerContextValue>({
  current: SERVERS[0],
  setCurrent: () => {},
});

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrentState] = useState<Server>(SERVERS[0]);

  const setCurrent = useCallback((s: Server) => {
    setApiBase(`/api/proxy/${s.type}`);
    setCurrentState(s);
  }, []);

  return (
    <ServerContext.Provider value={{ current, setCurrent }}>
      {children}
    </ServerContext.Provider>
  );
}

export const useServer = () => useContext(ServerContext);
