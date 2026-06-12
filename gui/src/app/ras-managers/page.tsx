'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Paper, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', flexShrink: 0, fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const MGR_ID = 'BMC';

export default function RasManagersPage() {
  const [tab, setTab] = useState(0);
  const [manager, setManager] = useState<AnyObj | null>(null);
  const [networkProtocol, setNetworkProtocol] = useState<AnyObj | null>(null);
  const [ethInterfaces, setEthInterfaces] = useState<AnyObj[]>([]);
  const [logEntries, setLogEntries] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchManager = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers') as AnyObj;
      const members = (col.Members ?? []) as AnyObj[];
      if (members.length > 0) {
        const data = await apiGet(members[0]['@odata.id'] as string) as AnyObj;
        setManager(data);
      }
    } catch {
      notify('Manager 情報の取得に失敗しました', 'error');
    }
  }, []);

  const fetchNetworkProtocol = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers') as AnyObj;
      const members = (col.Members ?? []) as AnyObj[];
      if (members.length > 0) {
        const mgr = await apiGet(members[0]['@odata.id'] as string) as AnyObj;
        const npPath = (mgr.NetworkProtocol as AnyObj)?.['@odata.id'] as string;
        if (npPath) {
          const data = await apiGet(npPath) as AnyObj;
          setNetworkProtocol(data);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchEthInterfaces = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers') as AnyObj;
      const members = (col.Members ?? []) as AnyObj[];
      if (members.length > 0) {
        const mgr = await apiGet(members[0]['@odata.id'] as string) as AnyObj;
        const ethPath = (mgr.EthernetInterfaces as AnyObj)?.['@odata.id'] as string;
        if (ethPath) {
          const ethCol = await apiGet(ethPath) as AnyObj;
          const items = await Promise.all(
            ((ethCol.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
          );
          setEthInterfaces(items as AnyObj[]);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchLogEntries = useCallback(async () => {
    try {
      const col = await apiGet(`/redfish/v1/Managers/${MGR_ID}/LogServices/Log/Entries`) as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setLogEntries(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchManager(), fetchNetworkProtocol(), fetchEthInterfaces(), fetchLogEntries()]);
    setLoading(false);
  }, [fetchManager, fetchNetworkProtocol, fetchEthInterfaces, fetchLogEntries]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleClearLog = async () => {
    if (!confirm('ログをクリアしますか？')) return;
    try {
      await apiPost(`/redfish/v1/Managers/${MGR_ID}/LogServices/Log/Actions/LogService.ClearLog`, {});
      notify('ログをクリアしました');
      fetchLogEntries();
    } catch {
      notify('クリアに失敗しました', 'error');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight="bold">Managers (RAS-EMU)</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Overview" />
        <Tab label="Network Protocol" />
        <Tab label={`Ethernet (${ethInterfaces.length})`} />
        <Tab label={`Log (${logEntries.length})`} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {manager && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Manager 情報</Typography>
            <InfoRow label="ID" value={manager.Id as string} />
            <InfoRow label="名前" value={manager.Name as string} />
            <InfoRow label="タイプ" value={manager.ManagerType as string} />
            <InfoRow label="ファームウェア" value={manager.FirmwareVersion as string} />
            <InfoRow label="UUID" value={manager.UUID as string} />
            <InfoRow label="ホスト名" value={manager.HostName as string} />
            <InfoRow label="ステータス" value={
              <Chip
                label={`${(manager.Status as AnyObj)?.State ?? '-'} / ${(manager.Status as AnyObj)?.Health ?? '-'}`}
                color={(manager.Status as AnyObj)?.Health === 'OK' ? 'success' : 'error'}
                size="small"
              />} />
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        {networkProtocol && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>ネットワークプロトコル</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>プロトコル</TableCell>
                    <TableCell>状態</TableCell>
                    <TableCell align="right">ポート</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(['HTTP', 'HTTPS', 'SNMP', 'SSH'] as const).map((proto) => {
                    const p = networkProtocol[proto] as AnyObj | undefined;
                    if (!p) return null;
                    return (
                      <TableRow key={proto} hover>
                        <TableCell>{proto}</TableCell>
                        <TableCell>
                          <Chip label={p.ProtocolEnabled ? '有効' : '無効'}
                            color={p.ProtocolEnabled ? 'success' : 'default'} size="small" />
                        </TableCell>
                        <TableCell align="right">{p.Port as number ?? '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={tab} index={2}>
        {ethInterfaces.map((iface) => (
          <Paper key={iface.Id as string} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">{iface.Id as string}</Typography>
            </Box>
            <InfoRow label="MAC アドレス" value={iface.MACAddress as string ?? '-'} />
            <InfoRow label="IPv4 アドレス" value={
              ((iface.IPv4Addresses ?? []) as AnyObj[]).map((a) => a.Address as string).join(', ') || '-'
            } />
            <InfoRow label="サブネットマスク" value={
              ((iface.IPv4Addresses ?? []) as AnyObj[]).map((a) => a.SubnetMask as string).join(', ') || '-'
            } />
            <InfoRow label="ゲートウェイ" value={
              ((iface.IPv4Addresses ?? []) as AnyObj[]).map((a) => a.Gateway as string).join(', ') || '-'
            } />
          </Paper>
        ))}
        {ethInterfaces.length === 0 && (
          <Typography color="text.secondary">Ethernet インターフェースなし</Typography>
        )}
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">ログ ({logEntries.length})</Typography>
          <Button size="small" color="error" startIcon={<ClearAllIcon />} onClick={handleClearLog}>
            クリア
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>タイムスタンプ</TableCell>
                <TableCell>重大度</TableCell>
                <TableCell>メッセージ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logEntries.map((e) => (
                <TableRow key={e.Id as string} hover>
                  <TableCell>{e.Id as string}</TableCell>
                  <TableCell>{(e.Created ?? e.EventTimestamp) as string}</TableCell>
                  <TableCell>
                    <Chip label={(e.Severity ?? e.EntryType) as string ?? '-'} size="small"
                      color={(e.Severity as string) === 'Critical' ? 'error'
                        : (e.Severity as string) === 'Warning' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>{e.Message as string}</TableCell>
                </TableRow>
              ))}
              {logEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">ログエントリなし</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}
