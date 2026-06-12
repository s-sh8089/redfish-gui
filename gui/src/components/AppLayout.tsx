'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppBar, Box, Button, Chip, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, ToggleButton, ToggleButtonGroup,
  Toolbar, Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import ComputerIcon from '@mui/icons-material/Computer';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DnsIcon from '@mui/icons-material/Dns';
import EventIcon from '@mui/icons-material/Event';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import TaskIcon from '@mui/icons-material/Task';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { SERVERS, useServer } from '@/context/ServerContext';
import { useAuth } from '@/context/AuthContext';

const DRAWER_WIDTH = 220;

const EMU_NAV = [
  { label: 'ダッシュボード', path: '/', icon: <DashboardIcon /> },
  { label: 'Systems', path: '/systems', icon: <ComputerIcon /> },
  { label: 'Chassis', path: '/chassis', icon: <DnsIcon /> },
  { label: 'Managers', path: '/managers', icon: <ManageAccountsIcon /> },
  { label: 'Accounts', path: '/accounts', icon: <PeopleIcon /> },
  { label: 'Sessions', path: '/sessions', icon: <VpnKeyIcon /> },
  { label: 'Events', path: '/events', icon: <EventIcon /> },
  { label: 'Update', path: '/update', icon: <SystemUpdateAltIcon /> },
  { label: 'Tasks', path: '/tasks', icon: <TaskIcon /> },
  { label: 'Certificates', path: '/certificates', icon: <SecurityIcon /> },
];

const RAS_EMU_NAV = [
  { label: 'ダッシュボード', path: '/', icon: <DashboardIcon /> },
  { label: 'Power Equipment', path: '/power-equipment', icon: <BoltIcon /> },
  { label: 'Chassis', path: '/ras-chassis', icon: <StorageIcon /> },
  { label: 'Managers', path: '/ras-managers', icon: <ManageAccountsIcon /> },
  { label: 'Events', path: '/ras-events', icon: <EventIcon /> },
  { label: 'Tasks', path: '/ras-tasks', icon: <TaskIcon /> },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { current, setCurrent } = useServer();
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated) return null;

  const navItems = current.type === 'emu' ? EMU_NAV : RAS_EMU_NAV;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Redfish GUI
          </Typography>
          <ToggleButtonGroup
            value={current.port}
            exclusive
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1 }}
          >
            {SERVERS.map((s) => (
              <ToggleButton
                key={s.port}
                value={s.port}
                onClick={() => { setCurrent(s); router.push('/'); }}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.3)',
                  '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.25)', color: 'white' },
                  fontSize: '0.75rem',
                  px: 1.5,
                }}
              >
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<LockOpenIcon sx={{ color: 'white !important', fontSize: '0.9rem' }} />}
              label="認証済み"
              size="small"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}
              variant="outlined"
            />
            <Button
              size="small"
              onClick={logout}
              sx={{ color: 'white', fontSize: '0.75rem', minWidth: 0 }}
            >
              ログアウト
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {navItems.map((item) => (
              <ListItem key={`${item.path}-${item.label}`} disablePadding>
                <ListItemButton
                  selected={item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)}
                  onClick={() => router.push(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
