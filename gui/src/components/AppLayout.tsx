'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppBar, Badge, Box, Button, Chip, Divider, Drawer, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Popover, Stack, ToggleButton, ToggleButtonGroup, Toolbar, Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import ComputerIcon from '@mui/icons-material/Computer';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DnsIcon from '@mui/icons-material/Dns';
import EventIcon from '@mui/icons-material/Event';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import TaskIcon from '@mui/icons-material/Task';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { SERVERS, useServer } from '@/context/ServerContext';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';

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

type LogEntry = {
  Id: string;
  Severity?: string;
  Message?: string;
  Created?: string;
};

const LOG_SOURCE: Record<string, { path: string; logPage: string; logLabel: string }> = {
  emu: {
    path: '/redfish/v1/Systems/system/LogServices/EventLog/Entries/',
    logPage: '/systems',
    logLabel: 'Systems › Log Services',
  },
  'ras-emu': {
    path: '/redfish/v1/Chassis/Rack1/LogServices/Log/Entries',
    logPage: '/ras-chassis',
    logLabel: 'Chassis › Log',
  },
};

function severityColor(sev?: string): 'error' | 'warning' | 'default' {
  if (sev === 'Critical') return 'error';
  if (sev === 'Warning') return 'warning';
  return 'default';
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { current, setCurrent } = useServer();
  const { isAuthenticated, logout } = useAuth();
  const [alertEntries, setAlertEntries] = useState<LogEntry[]>([]);
  const [alertAnchor, setAlertAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, pathname, router]);

  const fetchAlerts = useCallback(async () => {
    const src = LOG_SOURCE[current.type];
    if (!src) return;
    try {
      const col = await apiGet(src.path) as { Members?: Array<Record<string, unknown>> };
      const members = (col.Members ?? []).slice(-5).reverse();
      const entries = await Promise.all(
        members.map((m) => apiGet(m['@odata.id'] as string))
      );
      setAlertEntries(entries as LogEntry[]);
    } catch {
      setAlertEntries([]);
    }
  }, [current.type]);

  useEffect(() => {
    if (isAuthenticated) fetchAlerts();
  }, [isAuthenticated, fetchAlerts]);

  if (!isAuthenticated) return null;

  const navItems = current.type === 'emu' ? EMU_NAV : RAS_EMU_NAV;
  const alertSrc = LOG_SOURCE[current.type];
  const badgeCount = alertEntries.filter(
    (e) => e.Severity === 'Critical' || e.Severity === 'Warning'
  ).length;
  const badgeColor: 'error' | 'warning' = alertEntries.some((e) => e.Severity === 'Critical')
    ? 'error'
    : 'warning';

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

          <IconButton
            size="small"
            onClick={(e) => setAlertAnchor(e.currentTarget)}
            sx={{ color: 'white' }}
          >
            <Badge badgeContent={badgeCount || undefined} color={badgeColor} max={99}>
              <NotificationsIcon />
            </Badge>
          </IconButton>

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

      <Popover
        open={Boolean(alertAnchor)}
        anchorEl={alertAnchor}
        onClose={() => setAlertAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 400 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">アラート（最新5件）</Typography>
            <IconButton size="small" onClick={fetchAlerts}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
          <Divider />
          {alertEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: 'center' }}>
              ログエントリなし
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {alertEntries.map((entry) => (
                <Box key={entry.Id} sx={{ px: 2, py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      label={entry.Severity ?? 'Info'}
                      color={severityColor(entry.Severity)}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(entry.Created)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {entry.Message ?? '(メッセージなし)'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
          <Divider />
          <Box sx={{ px: 2, py: 1, textAlign: 'right' }}>
            <Button
              size="small"
              endIcon={<span>→</span>}
              onClick={() => { router.push(alertSrc.logPage); setAlertAnchor(null); }}
            >
              {alertSrc.logLabel}
            </Button>
          </Box>
        </Box>
      </Popover>

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
