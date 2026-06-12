'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select,
  Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from '@mui/material';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import EjectIcon from '@mui/icons-material/Eject';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

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

function ProtocolRow({ label, proto }: { label: string; proto: AnyObj }) {
  if (!proto) return null;
  return (
    <TableRow hover>
      <TableCell>{label}</TableCell>
      <TableCell>
        <Chip
          label={proto.ProtocolEnabled ? '有効' : '無効'}
          color={proto.ProtocolEnabled ? 'success' : 'default'}
          size="small"
        />
      </TableCell>
      <TableCell align="right">{proto.Port ?? '-'}</TableCell>
      <TableCell>{proto.NTPServers ? proto.NTPServers.join(', ') : '-'}</TableCell>
    </TableRow>
  );
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const RESET_TYPES = ['GracefulRestart', 'ForceRestart'];

export default function ManagersPage() {
  const [tab, setTab] = useState(0);
  const [bmc, setBmc] = useState<AnyObj | null>(null);
  const [networkProtocol, setNetworkProtocol] = useState<AnyObj | null>(null);
  const [virtualMedia, setVirtualMedia] = useState<AnyObj[]>([]);
  const [ethInterfaces, setEthInterfaces] = useState<AnyObj[]>([]);
  const [hostInterfaces, setHostInterfaces] = useState<AnyObj[]>([]);
  const [serialInterfaces, setSerialInterfaces] = useState<AnyObj[]>([]);
  const [redfishLogEntries, setRedfishLogEntries] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const [resetType, setResetType] = useState(RESET_TYPES[0]);

  const [insertDialog, setInsertDialog] = useState<{ open: boolean; vmId: string }>({ open: false, vmId: '' });
  const [insertImage, setInsertImage] = useState('');

  const [dateTimeDialog, setDateTimeDialog] = useState(false);
  const [dateTimeForm, setDateTimeForm] = useState({ DateTime: '', DateTimeLocalOffset: '+09:00' });

  const [certUploadDialog, setCertUploadDialog] = useState(false);
  const [certString, setCertString] = useState('');

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchBmc = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/Managers/bmc/') as AnyObj;
      setBmc(data);
    } catch {
      notify('BMC 情報の取得に失敗しました', 'error');
    }
  }, []);

  const fetchNetworkProtocol = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/Managers/bmc/NetworkProtocol/') as AnyObj;
      setNetworkProtocol(data);
    } catch { /* ignore */ }
  }, []);

  const fetchVirtualMedia = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers/bmc/VirtualMedia/') as AnyObj;
      const items = await Promise.all(
        (col.Members ?? []).map((m: AnyObj) => apiGet(m['@odata.id']))
      );
      setVirtualMedia(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchEthInterfaces = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers/bmc/EthernetInterfaces/') as AnyObj;
      const items = await Promise.all(
        (col.Members ?? []).map((m: AnyObj) => apiGet(m['@odata.id']))
      );
      setEthInterfaces(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchHostInterfaces = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers/bmc/HostInterfaces/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setHostInterfaces(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchSerialInterfaces = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers/bmc/SerialInterfaces/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setSerialInterfaces(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchRedfishLog = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Managers/bmc/LogServices/RedfishLog/Entries/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setRedfishLogEntries(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchBmc(), fetchNetworkProtocol(), fetchVirtualMedia(),
      fetchEthInterfaces(), fetchHostInterfaces(), fetchSerialInterfaces(), fetchRedfishLog(),
    ]);
    setLoading(false);
  }, [fetchBmc, fetchNetworkProtocol, fetchVirtualMedia, fetchEthInterfaces,
    fetchHostInterfaces, fetchSerialInterfaces, fetchRedfishLog]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleBmcReset = async (resetType: string) => {
    try {
      await apiPost('/redfish/v1/Managers/bmc/Actions/Manager.Reset', { ResetType: resetType });
      notify(`${resetType} を実行しました`);
      setTimeout(fetchBmc, 500);
    } catch {
      notify('操作に失敗しました', 'error');
    }
  };

  const handleForceFailover = async () => {
    if (!confirm('ForceFailover を実行しますか？')) return;
    try {
      await apiPost('/redfish/v1/Managers/bmc/Actions/Manager.ForceFailover', {});
      notify('ForceFailover を実行しました');
    } catch {
      notify('ForceFailover に失敗しました', 'error');
    }
  };

  const handleDateTimePatch = async () => {
    try {
      await apiPatch('/redfish/v1/Managers/bmc/', {
        DateTime: dateTimeForm.DateTime,
        DateTimeLocalOffset: dateTimeForm.DateTimeLocalOffset,
      });
      notify('日時を更新しました');
      setDateTimeDialog(false);
      fetchBmc();
    } catch {
      notify('日時の更新に失敗しました', 'error');
    }
  };

  const handleInsertMedia = async () => {
    if (!insertImage.trim()) return;
    try {
      await apiPost(
        `/redfish/v1/Managers/bmc/VirtualMedia/${insertDialog.vmId}/Actions/VirtualMedia.InsertMedia`,
        { Image: insertImage, WriteProtected: true }
      );
      notify('メディアを挿入しました');
      setInsertDialog({ open: false, vmId: '' });
      setInsertImage('');
      fetchVirtualMedia();
    } catch {
      notify('メディアの挿入に失敗しました', 'error');
    }
  };

  const handleEjectMedia = async (vmId: string) => {
    try {
      await apiPost(
        `/redfish/v1/Managers/bmc/VirtualMedia/${vmId}/Actions/VirtualMedia.EjectMedia`,
        {}
      );
      notify('メディアを排出しました');
      fetchVirtualMedia();
    } catch {
      notify('メディアの排出に失敗しました', 'error');
    }
  };

  const handleCertUpload = async () => {
    try {
      await apiPost('/redfish/v1/Managers/bmc/NetworkProtocol/HTTPS/Certificates/', {
        CertificateString: certString,
        CertificateType: 'PEM',
      });
      notify('証明書をアップロードしました');
      setCertUploadDialog(false);
      setCertString('');
    } catch {
      notify('証明書のアップロードに失敗しました', 'error');
    }
  };

  const handleClearRedfishLog = async () => {
    if (!confirm('RedfishLog をクリアしますか？')) return;
    try {
      await apiPost('/redfish/v1/Managers/bmc/LogServices/RedfishLog/Actions/LogService.ClearLog', {});
      notify('RedfishLog をクリアしました');
      fetchRedfishLog();
    } catch {
      notify('クリアに失敗しました', 'error');
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
        <Typography variant="h5" fontWeight="bold">Managers</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Overview" />
        <Tab label="Network Protocol" />
        <Tab label={`Virtual Media (${virtualMedia.length})`} />
        <Tab label={`Ethernet (${ethInterfaces.length})`} />
        <Tab label={`Host Interfaces (${hostInterfaces.length})`} />
        <Tab label={`Serial Interfaces (${serialInterfaces.length})`} />
        <Tab label={`RedfishLog (${redfishLogEntries.length})`} />
      </Tabs>

      {/* Overview */}
      <TabPanel value={tab} index={0}>
        {bmc && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">BMC 情報</Typography>
              <InfoRow label="ID" value={bmc.Id} />
              <InfoRow label="名前" value={bmc.Name} />
              <InfoRow label="タイプ" value={bmc.ManagerType} />
              <InfoRow label="メーカー" value={bmc.Manufacturer} />
              <InfoRow label="モデル" value={bmc.Model} />
              <InfoRow label="ファームウェアバージョン" value={bmc.FirmwareVersion} />
              <InfoRow label="シリアル番号" value={bmc.SerialNumber} />
              <InfoRow label="電源状態" value={<PowerChip state={bmc.PowerState} />} />
              <InfoRow label="ステータス" value={<StatusChip state={bmc.Status?.State} health={bmc.Status?.Health} />} />
              <InfoRow label="日時" value={bmc.DateTime} />
              <InfoRow label="UUID" value={bmc.UUID} />
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">BMC 操作</Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Reset Type</InputLabel>
                    <Select value={resetType} label="Reset Type" onChange={(e) => setResetType(e.target.value)}>
                      {RESET_TYPES.map((rt) => <MenuItem key={rt} value={rt}>{rt}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button variant="contained" color="warning" onClick={() => handleBmcReset(resetType)}>
                    Reset
                  </Button>
                  <Button variant="outlined" color="error" onClick={handleForceFailover}>
                    ForceFailover
                  </Button>
                  <Button variant="outlined" onClick={() => {
                    setDateTimeForm({ DateTime: bmc.DateTime ?? '', DateTimeLocalOffset: bmc.DateTimeLocalOffset ?? '+09:00' });
                    setDateTimeDialog(true);
                  }}>
                    日時設定
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        )}
      </TabPanel>

      {/* Network Protocol */}
      <TabPanel value={tab} index={1}>
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">ネットワークプロトコル</Typography>
            {networkProtocol && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>プロトコル</TableCell>
                      <TableCell>状態</TableCell>
                      <TableCell align="right">ポート</TableCell>
                      <TableCell>NTP サーバー</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <ProtocolRow label="HTTP" proto={networkProtocol.HTTP} />
                    <ProtocolRow label="HTTPS" proto={networkProtocol.HTTPS} />
                    <ProtocolRow label="SSH" proto={networkProtocol.SSH} />
                    <ProtocolRow label="IPMI" proto={networkProtocol.IPMI} />
                    <ProtocolRow label="NTP" proto={networkProtocol.NTP} />
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">HTTPS 証明書</Typography>
              <Button size="small" variant="outlined" startIcon={<UploadIcon />}
                onClick={() => { setCertString(''); setCertUploadDialog(true); }}>
                証明書アップロード
              </Button>
            </Box>
          </Paper>
        </Stack>
      </TabPanel>

      {/* Virtual Media */}
      <TabPanel value={tab} index={2}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>メディアタイプ</TableCell>
                <TableCell>イメージ</TableCell>
                <TableCell>接続状態</TableCell>
                <TableCell>挿入済み</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {virtualMedia.map((vm) => (
                <TableRow key={vm.Id} hover>
                  <TableCell>{vm.Id}</TableCell>
                  <TableCell>{vm.Name}</TableCell>
                  <TableCell>{(vm.MediaTypes ?? []).join(', ')}</TableCell>
                  <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>
                    {vm.Image || '-'}
                  </TableCell>
                  <TableCell>{vm.ConnectedVia}</TableCell>
                  <TableCell>
                    <Chip
                      label={vm.Inserted ? '挿入済み' : '未挿入'}
                      color={vm.Inserted ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {vm.Inserted ? (
                      <Button size="small" variant="outlined" color="error" startIcon={<EjectIcon />}
                        onClick={() => handleEjectMedia(vm.Id)}>
                        排出
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" startIcon={<UploadIcon />}
                        onClick={() => { setInsertDialog({ open: true, vmId: vm.Id }); setInsertImage(''); }}>
                        挿入
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Ethernet Interfaces */}
      <TabPanel value={tab} index={3}>
        {ethInterfaces.map((iface) => (
          <Paper key={iface.Id} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">{iface.Id}</Typography>
              <Chip label={iface.LinkStatus} color={iface.LinkStatus === 'LinkUp' ? 'success' : 'default'} size="small" />
              <StatusChip state={iface.Status?.State} health={iface.Status?.Health} />
            </Box>
            <InfoRow label="MAC アドレス" value={iface.MACAddress} />
            <InfoRow label="FQDN" value={iface.FQDN} />
            <InfoRow label="ホスト名" value={iface.HostName} />
            <InfoRow label="速度 (Mbps)" value={iface.SpeedMbps} />
            <InfoRow label="IPv4 アドレス" value={(iface.IPv4Addresses ?? []).map((a: AnyObj) => a.Address).join(', ') || '-'} />
            <InfoRow label="IPv6 アドレス" value={(iface.IPv6Addresses ?? []).map((a: AnyObj) => a.Address).join(', ') || '-'} />
            <InfoRow label="DNS サーバー" value={(iface.NameServers ?? []).join(', ') || '-'} />
          </Paper>
        ))}
      </TabPanel>

      {/* Host Interfaces */}
      <TabPanel value={tab} index={4}>
        {hostInterfaces.map((hi) => (
          <Paper key={hi.Id as string} sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{hi.Id as string}</Typography>
            <InfoRow label="名前" value={hi.Name as string ?? '-'} />
            <InfoRow label="タイプ" value={hi.InterfaceType as string ?? '-'} />
            <InfoRow label="接続タイプ" value={hi.ExternallyAccessible as boolean ? '外部アクセス可' : '内部のみ'} />
            <InfoRow label="ステータス" value={
              hi.Status
                ? <Chip label={`${(hi.Status as AnyObj).State ?? '-'} / ${(hi.Status as AnyObj).Health ?? '-'}`}
                  color={(hi.Status as AnyObj).Health === 'OK' ? 'success' : 'error'} size="small" />
                : '-'
            } />
          </Paper>
        ))}
        {hostInterfaces.length === 0 && (
          <Typography color="text.secondary">HostInterface なし</Typography>
        )}
      </TabPanel>

      {/* Serial Interfaces */}
      <TabPanel value={tab} index={5}>
        {serialInterfaces.map((si) => (
          <Paper key={si.Id as string} sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{si.Id as string}</Typography>
            <InfoRow label="名前" value={si.Name as string ?? '-'} />
            <InfoRow label="ボーレート" value={si.BitRate as number ?? '-'} />
            <InfoRow label="パリティ" value={si.Parity as string ?? '-'} />
            <InfoRow label="データビット" value={si.DataBits as number ?? '-'} />
            <InfoRow label="ストップビット" value={si.StopBits as number ?? '-'} />
            <InfoRow label="フロー制御" value={si.FlowControl as string ?? '-'} />
            <InfoRow label="信号タイプ" value={si.SignalType as string ?? '-'} />
          </Paper>
        ))}
        {serialInterfaces.length === 0 && (
          <Typography color="text.secondary">SerialInterface なし</Typography>
        )}
      </TabPanel>

      {/* RedfishLog */}
      <TabPanel value={tab} index={6}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            RedfishLog ({redfishLogEntries.length})
          </Typography>
          <Button size="small" color="error" startIcon={<ClearAllIcon />} onClick={handleClearRedfishLog}>
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
              {redfishLogEntries.map((e) => (
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
              {redfishLogEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">ログエントリなし</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Insert Media Dialog */}
      <Dialog open={insertDialog.open} onClose={() => setInsertDialog({ open: false, vmId: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>メディア挿入 — {insertDialog.vmId}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Image URL" placeholder="http://example.com/image.iso"
            value={insertImage} onChange={(e) => setInsertImage(e.target.value)} sx={{ mt: 1 }} size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInsertDialog({ open: false, vmId: '' })}>キャンセル</Button>
          <Button variant="contained" onClick={handleInsertMedia} disabled={!insertImage.trim()}>挿入</Button>
        </DialogActions>
      </Dialog>

      {/* DateTime Dialog */}
      <Dialog open={dateTimeDialog} onClose={() => setDateTimeDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>BMC 日時設定</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="DateTime (ISO 8601)" size="small" fullWidth
              placeholder="2025-01-15T09:00:00+09:00"
              value={dateTimeForm.DateTime}
              onChange={(e) => setDateTimeForm((p) => ({ ...p, DateTime: e.target.value }))} />
            <TextField label="DateTimeLocalOffset" size="small" fullWidth
              placeholder="+09:00"
              value={dateTimeForm.DateTimeLocalOffset}
              onChange={(e) => setDateTimeForm((p) => ({ ...p, DateTimeLocalOffset: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDateTimeDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleDateTimePatch} disabled={!dateTimeForm.DateTime}>適用</Button>
        </DialogActions>
      </Dialog>

      {/* Certificate Upload Dialog */}
      <Dialog open={certUploadDialog} onClose={() => setCertUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>HTTPS 証明書アップロード</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus multiline rows={10} fullWidth size="small"
            label="CertificateString (PEM)" sx={{ mt: 1 }}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            value={certString}
            onChange={(e) => setCertString(e.target.value)}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCertUploadDialog(false)}>キャンセル</Button>
          <Button variant="contained" startIcon={<UploadIcon />} onClick={handleCertUpload}
            disabled={!certString.trim()}>
            アップロード
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
