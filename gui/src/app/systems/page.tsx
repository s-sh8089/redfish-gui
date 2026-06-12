'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Paper,
  Select, Snackbar, Stack, Switch, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from '@mui/material';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function StatusChip({ state, health }: { state: string; health: string }) {
  const color = health === 'OK' ? 'success' : health === 'Warning' ? 'warning' : 'error';
  return <Chip label={`${state} / ${health}`} color={color} size="small" />;
}

function PowerChip({ state }: { state: string }) {
  return <Chip label={state} color={state === 'On' ? 'success' : 'default'} size="small" />;
}

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

const RESET_TYPES = ['On', 'ForceOff', 'GracefulShutdown', 'GracefulRestart', 'ForceRestart', 'Nmi', 'ForceOn', 'PushPowerButton'];
const BOOT_TARGETS = ['None', 'Pxe', 'Cd', 'Usb', 'Hdd', 'BiosSetup', 'Diags', 'SDCard', 'UefiShell', 'UefiTarget'];
const BOOT_ENABLED = ['Disabled', 'Once', 'Continuous'];
const BOOT_MODES = ['UEFI', 'Legacy'];

export default function SystemsPage() {
  const [tab, setTab] = useState(0);
  const [system, setSystem] = useState<AnyObj | null>(null);
  const [processors, setProcessors] = useState<AnyObj[]>([]);
  const [memories, setMemories] = useState<AnyObj[]>([]);
  const [storages, setStorages] = useState<AnyObj[]>([]);
  const [ethInterfaces, setEthInterfaces] = useState<AnyObj[]>([]);
  const [bios, setBios] = useState<AnyObj | null>(null);
  const [secureBoot, setSecureBoot] = useState<AnyObj | null>(null);
  const [eventLogEntries, setEventLogEntries] = useState<AnyObj[]>([]);
  const [selEntries, setSelEntries] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const [resetType, setResetType] = useState(RESET_TYPES[0]);
  const [secureBootEnable, setSecureBootEnable] = useState('有効');
  const [bootTarget, setBootTarget] = useState('');
  const [bootEnabled, setBootEnabled] = useState('');
  const [bootMode, setBootMode] = useState('');
  const [biosAttrs, setBiosAttrs] = useState<AnyObj>({});

  const [biosPasswordDialog, setBiosPasswordDialog] = useState(false);
  const [biosPassword, setBiosPassword] = useState({ OldPassword: '', NewPassword: '' });

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchSystem = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/Systems/system') as AnyObj;
      setSystem(data);
      setBootTarget((data.Boot as AnyObj)?.BootSourceOverrideTarget as string ?? '');
      setBootEnabled((data.Boot as AnyObj)?.BootSourceOverrideEnabled as string ?? '');
      setBootMode((data.Boot as AnyObj)?.BootSourceOverrideMode as string ?? '');
    } catch {
      notify('システム情報の取得に失敗しました', 'error');
    }
  }, []);

  const fetchProcessors = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Systems/system/Processors/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setProcessors(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchMemory = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Systems/system/Memory/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setMemories(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchStorage = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Systems/system/Storage/') as AnyObj;
      const storageItems = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map(async (m) => {
          const s = await apiGet(m['@odata.id'] as string) as AnyObj;
          const storageId = (m['@odata.id'] as string).split('/').filter(Boolean).pop() as string;
          if ((s.Drives as AnyObj[])?.length > 0) {
            s.DriveDetails = await Promise.all(
              (s.Drives as AnyObj[]).map((d) => apiGet(d['@odata.id'] as string))
            );
          } else {
            s.DriveDetails = [];
          }
          try {
            const ctrlCol = await apiGet(`/redfish/v1/Systems/system/Storage/${storageId}/Controllers/`) as AnyObj;
            s.ControllerDetails = await Promise.all(
              ((ctrlCol.Members ?? []) as AnyObj[]).map((c) => apiGet(c['@odata.id'] as string))
            );
          } catch { s.ControllerDetails = []; }
          try {
            const volCol = await apiGet(`/redfish/v1/Systems/system/Storage/${storageId}/Volumes/`) as AnyObj;
            s.VolumeDetails = await Promise.all(
              ((volCol.Members ?? []) as AnyObj[]).map((v) => apiGet(v['@odata.id'] as string))
            );
          } catch { s.VolumeDetails = []; }
          return s;
        })
      );
      setStorages(storageItems as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchEthInterfaces = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Systems/system/EthernetInterfaces/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setEthInterfaces(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchBios = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/Systems/system/Bios/') as AnyObj;
      setBios(data);
      setBiosAttrs({ ...((data.Attributes as AnyObj) ?? {}) });
    } catch { /* ignore */ }
  }, []);

  const fetchSecureBoot = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/Systems/system/SecureBoot/') as AnyObj;
      setSecureBoot(data);
    } catch { /* ignore */ }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const el = await apiGet('/redfish/v1/Systems/system/LogServices/EventLog/Entries/') as AnyObj;
      const elItems = await Promise.all(
        ((el.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setEventLogEntries(elItems as AnyObj[]);
    } catch { /* ignore */ }
    try {
      const sel = await apiGet('/redfish/v1/Systems/system/LogServices/SEL/Entries/') as AnyObj;
      const selItems = await Promise.all(
        ((sel.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setSelEntries(selItems as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchSystem(), fetchProcessors(), fetchMemory(), fetchStorage(),
      fetchEthInterfaces(), fetchBios(), fetchSecureBoot(), fetchLogs(),
    ]);
    setLoading(false);
  }, [fetchSystem, fetchProcessors, fetchMemory, fetchStorage, fetchEthInterfaces, fetchBios, fetchSecureBoot, fetchLogs]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleReset = async (resetType: string) => {
    try {
      await apiPost('/redfish/v1/Systems/system/Actions/ComputerSystem.Reset', { ResetType: resetType });
      notify(`${resetType} を実行しました`);
      setTimeout(fetchSystem, 500);
    } catch {
      notify('操作に失敗しました', 'error');
    }
  };

  const handleBootPatch = async () => {
    try {
      await apiPatch('/redfish/v1/Systems/system', {
        Boot: {
          BootSourceOverrideTarget: bootTarget,
          BootSourceOverrideEnabled: bootEnabled,
          BootSourceOverrideMode: bootMode,
        },
      });
      notify('Boot 設定を更新しました');
      fetchSystem();
    } catch {
      notify('Boot 設定の更新に失敗しました', 'error');
    }
  };

  const handleBiosPatch = async () => {
    try {
      await apiPatch('/redfish/v1/Systems/system/Bios/', { Attributes: biosAttrs });
      notify('BIOS 設定を更新しました');
      fetchBios();
    } catch {
      notify('BIOS 設定の更新に失敗しました', 'error');
    }
  };

  const handleSecureBootPatch = async (enabled: boolean) => {
    try {
      await apiPatch('/redfish/v1/Systems/system/SecureBoot/', { SecureBootEnable: enabled });
      notify(`SecureBoot を${enabled ? '有効' : '無効'}にしました`);
      fetchSecureBoot();
    } catch {
      notify('SecureBoot 設定の更新に失敗しました', 'error');
    }
  };

  const handleBiosReset = async () => {
    if (!confirm('BIOS をデフォルト設定にリセットしますか？')) return;
    try {
      await apiPost('/redfish/v1/Systems/system/Bios/Actions/Bios.ResetBios', {});
      notify('BIOS をリセットしました');
      fetchBios();
    } catch {
      notify('BIOS のリセットに失敗しました', 'error');
    }
  };

  const handleBiosChangePassword = async () => {
    try {
      await apiPost('/redfish/v1/Systems/system/Bios/Actions/Bios.ChangePassword', {
        PasswordName: 'UserPassword',
        OldPassword: biosPassword.OldPassword,
        NewPassword: biosPassword.NewPassword,
      });
      notify('BIOS パスワードを変更しました');
      setBiosPasswordDialog(false);
      setBiosPassword({ OldPassword: '', NewPassword: '' });
    } catch {
      notify('パスワードの変更に失敗しました', 'error');
    }
  };

  const handleClearLog = async (logName: 'EventLog' | 'SEL') => {
    if (!confirm(`${logName} をクリアしますか？`)) return;
    try {
      await apiPost(`/redfish/v1/Systems/system/LogServices/${logName}/Actions/LogService.ClearLog`, {});
      notify(`${logName} をクリアしました`);
      fetchLogs();
    } catch {
      notify('ログのクリアに失敗しました', 'error');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight="bold">Systems</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Overview" />
        <Tab label={`Processors (${processors.length})`} />
        <Tab label={`Memory (${memories.length})`} />
        <Tab label={`Storage (${storages.length})`} />
        <Tab label={`Ethernet (${ethInterfaces.length})`} />
        <Tab label="BIOS" />
        <Tab label="SecureBoot" />
        <Tab label="Log Services" />
      </Tabs>

      {/* Overview */}
      <TabPanel value={tab} index={0}>
        {system && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">システム情報</Typography>
              <InfoRow label="名前" value={system.Name as string} />
              <InfoRow label="メーカー" value={system.Manufacturer as string} />
              <InfoRow label="モデル" value={system.Model as string} />
              <InfoRow label="シリアル番号" value={system.SerialNumber as string} />
              <InfoRow label="BIOSバージョン" value={system.BiosVersion as string} />
              <InfoRow label="電源状態" value={<PowerChip state={system.PowerState as string} />} />
              <InfoRow label="ステータス" value={
                <StatusChip state={(system.Status as AnyObj)?.State as string}
                  health={(system.Status as AnyObj)?.Health as string} />} />
              <InfoRow label="CPU" value={`${(system.ProcessorSummary as AnyObj)?.Count ?? '-'} 基`} />
              <InfoRow label="メモリ" value={`${(system.MemorySummary as AnyObj)?.TotalSystemMemoryGiB ?? '-'} GiB`} />
              <InfoRow label="電源復帰ポリシー" value={system.PowerRestorePolicy as string} />
              <InfoRow label="電源モード" value={system.PowerMode as string} />
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">電源操作</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Reset Type</InputLabel>
                  <Select value={resetType} label="Reset Type" onChange={(e) => setResetType(e.target.value)}>
                    {RESET_TYPES.map((rt) => <MenuItem key={rt} value={rt}>{rt}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color={resetType === 'ForceOff' || resetType === 'GracefulShutdown' ? 'error' : 'primary'}
                  onClick={() => handleReset(resetType)}
                >
                  Apply
                </Button>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">Boot 設定</Typography>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Boot Target</InputLabel>
                  <Select value={bootTarget} label="Boot Target" onChange={(e) => setBootTarget(e.target.value)}>
                    {BOOT_TARGETS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Enabled</InputLabel>
                  <Select value={bootEnabled} label="Enabled" onChange={(e) => setBootEnabled(e.target.value)}>
                    {BOOT_ENABLED.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Mode</InputLabel>
                  <Select value={bootMode} label="Mode" onChange={(e) => setBootMode(e.target.value)}>
                    {BOOT_MODES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button variant="contained" size="small" onClick={handleBootPatch}>適用</Button>
              </Stack>
            </Paper>
          </Stack>
        )}
      </TabPanel>

      {/* Processors */}
      <TabPanel value={tab} index={1}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>タイプ</TableCell><TableCell>アーキテクチャ</TableCell>
                <TableCell>メーカー</TableCell><TableCell>モデル</TableCell>
                <TableCell align="right">最大速度 (MHz)</TableCell>
                <TableCell align="right">コア数</TableCell><TableCell align="right">スレッド数</TableCell>
                <TableCell>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processors.map((p) => (
                <TableRow key={p.Id as string} hover>
                  <TableCell>{p.Id as string}</TableCell>
                  <TableCell>{p.ProcessorType as string}</TableCell>
                  <TableCell>{p.ProcessorArchitecture as string}</TableCell>
                  <TableCell>{p.Manufacturer as string}</TableCell>
                  <TableCell>{p.Model as string}</TableCell>
                  <TableCell align="right">{(p.MaxSpeedMHz as number)?.toLocaleString()}</TableCell>
                  <TableCell align="right">{p.TotalCores as number}</TableCell>
                  <TableCell align="right">{p.TotalThreads as number}</TableCell>
                  <TableCell>
                    <StatusChip state={(p.Status as AnyObj)?.State as string}
                      health={(p.Status as AnyObj)?.Health as string} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Memory */}
      <TabPanel value={tab} index={2}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>タイプ</TableCell>
                <TableCell align="right">容量 (MiB)</TableCell>
                <TableCell>メーカー</TableCell><TableCell>モデル</TableCell>
                <TableCell align="right">速度 (MHz)</TableCell>
                <TableCell>シリアル番号</TableCell><TableCell>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {memories.map((m) => (
                <TableRow key={m.Id as string} hover>
                  <TableCell>{m.Id as string}</TableCell>
                  <TableCell>{m.BaseModuleType as string}</TableCell>
                  <TableCell align="right">{(m.CapacityMiB as number)?.toLocaleString()}</TableCell>
                  <TableCell>{m.Manufacturer as string}</TableCell>
                  <TableCell>{m.Model as string}</TableCell>
                  <TableCell align="right">{(m.OperatingSpeedMhz as number)?.toLocaleString()}</TableCell>
                  <TableCell>{m.SerialNumber as string}</TableCell>
                  <TableCell>
                    <StatusChip state={(m.Status as AnyObj)?.State as string}
                      health={(m.Status as AnyObj)?.Health as string} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Storage */}
      <TabPanel value={tab} index={3}>
        {storages.map((s) => (
          <Paper key={s.Id as string} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">{s.Id as string}</Typography>
              <StatusChip state={(s.Status as AnyObj)?.State as string}
                health={(s.Status as AnyObj)?.Health as string} />
              <Typography variant="body2" color="text.secondary">
                {(s['Drives@odata.count'] as number) ?? 0} ドライブ
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              ドライブ
            </Typography>
            <TableContainer sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ドライブ ID</TableCell>
                    <TableCell align="right">容量 (GB)</TableCell>
                    <TableCell>暗号化状態</TableCell>
                    <TableCell>ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {((s.DriveDetails ?? []) as AnyObj[]).map((d) => (
                    <TableRow key={d['@odata.id'] as string} hover>
                      <TableCell>
                        {d.Id as string ?? (d['@odata.id'] as string).split('/').filter(Boolean).pop()}
                      </TableCell>
                      <TableCell align="right">
                        {d.CapacityBytes != null ? ((d.CapacityBytes as number) / 1e9).toFixed(0) : '-'}
                      </TableCell>
                      <TableCell>{d.EncryptionStatus as string ?? '-'}</TableCell>
                      <TableCell>
                        {d.Status
                          ? <StatusChip state={(d.Status as AnyObj)?.State as string}
                            health={(d.Status as AnyObj)?.Health as string} />
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {((s.ControllerDetails ?? []) as AnyObj[]).length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  コントローラー
                </Typography>
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>名前</TableCell>
                        <TableCell>メーカー</TableCell>
                        <TableCell>モデル</TableCell>
                        <TableCell>ステータス</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {((s.ControllerDetails ?? []) as AnyObj[]).map((c) => (
                        <TableRow key={c['@odata.id'] as string} hover>
                          <TableCell>{c.Id as string ?? '-'}</TableCell>
                          <TableCell>{c.Name as string ?? '-'}</TableCell>
                          <TableCell>{c.Manufacturer as string ?? '-'}</TableCell>
                          <TableCell>{c.Model as string ?? '-'}</TableCell>
                          <TableCell>
                            {c.Status
                              ? <StatusChip state={(c.Status as AnyObj)?.State as string}
                                health={(c.Status as AnyObj)?.Health as string} />
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {((s.VolumeDetails ?? []) as AnyObj[]).length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  ボリューム
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>名前</TableCell>
                        <TableCell>タイプ</TableCell>
                        <TableCell align="right">容量 (GB)</TableCell>
                        <TableCell>ステータス</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {((s.VolumeDetails ?? []) as AnyObj[]).map((v) => (
                        <TableRow key={v['@odata.id'] as string} hover>
                          <TableCell>{v.Id as string ?? '-'}</TableCell>
                          <TableCell>{v.Name as string ?? '-'}</TableCell>
                          <TableCell>{v.VolumeType as string ?? '-'}</TableCell>
                          <TableCell align="right">
                            {v.CapacityBytes != null ? ((v.CapacityBytes as number) / 1e9).toFixed(0) : '-'}
                          </TableCell>
                          <TableCell>
                            {v.Status
                              ? <StatusChip state={(v.Status as AnyObj)?.State as string}
                                health={(v.Status as AnyObj)?.Health as string} />
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        ))}
      </TabPanel>

      {/* Ethernet Interfaces */}
      <TabPanel value={tab} index={4}>
        {ethInterfaces.map((iface) => (
          <Paper key={iface.Id as string} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">{iface.Id as string}</Typography>
              <Chip label={iface.LinkStatus as string ?? 'Unknown'}
                color={(iface.LinkStatus as string) === 'LinkUp' ? 'success' : 'default'} size="small" />
              <StatusChip state={(iface.Status as AnyObj)?.State as string}
                health={(iface.Status as AnyObj)?.Health as string} />
            </Box>
            <InfoRow label="MAC アドレス" value={iface.MACAddress as string ?? '-'} />
            <InfoRow label="FQDN" value={iface.FQDN as string ?? '-'} />
            <InfoRow label="ホスト名" value={iface.HostName as string ?? '-'} />
            <InfoRow label="速度 (Mbps)" value={iface.SpeedMbps as number ?? '-'} />
            <InfoRow label="IPv4 アドレス" value={
              ((iface.IPv4Addresses ?? []) as AnyObj[]).map((a) => a.Address as string).join(', ') || '-'
            } />
            <InfoRow label="IPv6 アドレス" value={
              ((iface.IPv6Addresses ?? []) as AnyObj[]).map((a) => a.Address as string).join(', ') || '-'
            } />
          </Paper>
        ))}
        {ethInterfaces.length === 0 && (
          <Typography color="text.secondary">Ethernet インターフェースなし</Typography>
        )}
      </TabPanel>

      {/* BIOS */}
      <TabPanel value={tab} index={5}>
        {bios && (
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">BIOS 設定</Typography>
              <Typography variant="body2" color="text.secondary">
                バージョン: {bios.BiosVersion as string ?? bios.Id as string}
              </Typography>
            </Box>
            <Stack spacing={2}>
              {Object.entries(biosAttrs).map(([key, val]) => {
                if (typeof val === 'boolean') {
                  return (
                    <FormControlLabel key={key}
                      control={
                        <Switch checked={val as boolean}
                          onChange={(e) => setBiosAttrs((p) => ({ ...p, [key]: e.target.checked }))} />
                      }
                      label={key}
                    />
                  );
                }
                return (
                  <TextField key={key} label={key} size="small" fullWidth
                    value={val as string ?? ''}
                    onChange={(e) => setBiosAttrs((p) => ({ ...p, [key]: e.target.value }))} />
                );
              })}
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" onClick={handleBiosPatch}>
                  BIOS 設定を保存
                </Button>
                <Button variant="outlined" size="small" color="warning" startIcon={<RestoreIcon />}
                  onClick={handleBiosReset}>
                  デフォルトにリセット
                </Button>
                <Button variant="outlined" size="small"
                  onClick={() => setBiosPasswordDialog(true)}>
                  パスワード変更
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </TabPanel>

      {/* SecureBoot */}
      <TabPanel value={tab} index={6}>
        {secureBoot && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>SecureBoot</Typography>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', fontWeight: 500 }}>
                  SecureBoot 有効
                </Typography>
                <Chip
                  label={secureBoot.SecureBootEnable ? '有効' : '無効'}
                  color={secureBoot.SecureBootEnable ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', fontWeight: 500 }}>
                  現在のモード
                </Typography>
                <Typography variant="body2">{secureBoot.SecureBootCurrentBoot as string ?? '-'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', py: 0.75 }}>
                <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', fontWeight: 500 }}>
                  モード
                </Typography>
                <Typography variant="body2">{secureBoot.SecureBootMode as string ?? '-'}</Typography>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>SecureBoot</InputLabel>
                  <Select value={secureBootEnable} label="SecureBoot" onChange={(e) => setSecureBootEnable(e.target.value)}>
                    <MenuItem value="有効">有効</MenuItem>
                    <MenuItem value="無効">無効</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color={secureBootEnable === '有効' ? 'success' : 'error'}
                  onClick={() => handleSecureBootPatch(secureBootEnable === '有効')}
                >
                  Apply
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </TabPanel>

      {/* Log Services */}
      <TabPanel value={tab} index={7}>
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">EventLog ({eventLogEntries.length})</Typography>
              <Button size="small" color="error" startIcon={<ClearAllIcon />}
                onClick={() => handleClearLog('EventLog')}>クリア</Button>
            </Box>
            <TableContainer>
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
                  {eventLogEntries.map((e) => (
                    <TableRow key={e.Id as string} hover>
                      <TableCell>{e.Id as string}</TableCell>
                      <TableCell>{e.Created as string}</TableCell>
                      <TableCell>
                        <Chip label={e.Severity as string ?? '-'} size="small"
                          color={(e.Severity as string) === 'Critical' ? 'error'
                            : (e.Severity as string) === 'Warning' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell>{e.Message as string}</TableCell>
                    </TableRow>
                  ))}
                  {eventLogEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">ログエントリなし</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">SEL ({selEntries.length})</Typography>
              <Button size="small" color="error" startIcon={<ClearAllIcon />}
                onClick={() => handleClearLog('SEL')}>クリア</Button>
            </Box>
            <TableContainer>
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
                  {selEntries.map((e) => (
                    <TableRow key={e.Id as string} hover>
                      <TableCell>{e.Id as string}</TableCell>
                      <TableCell>{e.Created as string}</TableCell>
                      <TableCell>
                        <Chip label={e.Severity as string ?? '-'} size="small"
                          color={(e.Severity as string) === 'Critical' ? 'error'
                            : (e.Severity as string) === 'Warning' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell>{e.Message as string}</TableCell>
                    </TableRow>
                  ))}
                  {selEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">ログエントリなし</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </TabPanel>

      {/* BIOS Password Change Dialog */}
      <Dialog open={biosPasswordDialog} onClose={() => setBiosPasswordDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>BIOS パスワード変更</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="現在のパスワード" type="password" size="small" fullWidth
              value={biosPassword.OldPassword}
              onChange={(e) => setBiosPassword((p) => ({ ...p, OldPassword: e.target.value }))} />
            <TextField label="新しいパスワード" type="password" size="small" fullWidth
              value={biosPassword.NewPassword}
              onChange={(e) => setBiosPassword((p) => ({ ...p, NewPassword: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBiosPasswordDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleBiosChangePassword}
            disabled={!biosPassword.OldPassword || !biosPassword.NewPassword}>
            変更
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}
