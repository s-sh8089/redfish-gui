'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select,
  Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Tabs, TextField, Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function StatusChip({ state, health }: { state?: string; health?: string }) {
  const color = health === 'OK' ? 'success' : health === 'Warning' ? 'warning' : 'error';
  if (!state && !health) return null;
  return <Chip label={`${state ?? '-'} / ${health ?? '-'}`} color={color} size="small" />;
}

function PowerStateChip({ state }: { state?: string }) {
  return <Chip label={state ?? '-'} color={state === 'On' ? 'success' : 'default'} size="small" />;
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

const OUTLET_POWER_STATES = ['On', 'Off', 'PowerCycle', 'GracefulShutdown'];

function SensorEditDialog({
  open, sensor, onClose, onSave,
}: {
  open: boolean;
  sensor: AnyObj | null;
  onClose: () => void;
  onSave: (path: string, reading: number) => void;
}) {
  const [reading, setReading] = useState('');
  useEffect(() => {
    if (sensor) setReading(String(sensor.Reading ?? ''));
  }, [sensor]);
  if (!sensor) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>センサー値更新 — {sensor.Name as string}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth size="small" label="Reading" type="number" sx={{ mt: 1 }}
          value={reading} onChange={(e) => setReading(e.target.value)}
          helperText={`単位: ${sensor.ReadingUnits as string ?? '-'}`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained"
          onClick={() => onSave(sensor['@odata.id'] as string, parseFloat(reading))}
          disabled={reading === ''}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PowerEquipmentPage() {
  const [mainTab, setMainTab] = useState(0);

  // RackPDU state
  const [pdu, setPdu] = useState<AnyObj | null>(null);
  const [pduOutlets, setPduOutlets] = useState<AnyObj[]>([]);
  const [pduSensors, setPduSensors] = useState<AnyObj[]>([]);
  const [pduMains, setPduMains] = useState<AnyObj[]>([]);
  const [pduBranches, setPduBranches] = useState<AnyObj[]>([]);
  const [pduMetrics, setPduMetrics] = useState<AnyObj | null>(null);
  const [pduTab, setPduTab] = useState(0);

  // Outlets state
  const [outlets, setOutlets] = useState<AnyObj[]>([]);

  // UPS state
  const [ups, setUps] = useState<AnyObj | null>(null);
  const [upsOutlets, setUpsOutlets] = useState<AnyObj[]>([]);
  const [upsSensors, setUpsSensors] = useState<AnyObj[]>([]);
  const [upsMains, setUpsMains] = useState<AnyObj[]>([]);
  const [upsMetrics, setUpsMetrics] = useState<AnyObj | null>(null);
  const [upsTab, setUpsTab] = useState(0);

  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  // Power control dialog
  const [powerDialog, setPowerDialog] = useState<{ open: boolean; path: string; name: string }>({
    open: false, path: '', name: '',
  });
  const [powerState, setPowerState] = useState('On');

  // Sensor edit dialog
  const [sensorDialog, setSensorDialog] = useState(false);
  const [editSensor, setEditSensor] = useState<AnyObj | null>(null);
  const [lineInputStatus, setLineInputStatus] = useState('Normal');

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchOutlets = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/Outlets') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setOutlets(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchPdu = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/PowerEquipment/RackPDUs/1') as AnyObj;
      setPdu(data);
    } catch { /* ignore */ }
  }, []);

  const fetchPduOutlets = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/RackPDUs/1/Outlets') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setPduOutlets(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchPduSensors = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/RackPDUs/1/Sensors') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setPduSensors(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchPduMains = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/RackPDUs/1/Mains') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setPduMains(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchPduBranches = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/RackPDUs/1/Branches') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setPduBranches(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchPduMetrics = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/PowerEquipment/RackPDUs/1/Metrics') as AnyObj;
      setPduMetrics(data);
    } catch { /* ignore */ }
  }, []);

  const fetchUps = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/PowerEquipment/UPSs/1') as AnyObj;
      setUps(data);
    } catch { /* ignore */ }
  }, []);

  const fetchUpsOutlets = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/UPSs/1/Outlets') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setUpsOutlets(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchUpsSensors = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/UPSs/1/Sensors') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setUpsSensors(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchUpsMains = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/PowerEquipment/UPSs/1/Mains') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setUpsMains(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchUpsMetrics = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/PowerEquipment/UPSs/1/Metrics') as AnyObj;
      setUpsMetrics(data);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchOutlets(),
      fetchPdu(), fetchPduOutlets(), fetchPduSensors(),
      fetchPduMains(), fetchPduBranches(), fetchPduMetrics(),
      fetchUps(), fetchUpsOutlets(), fetchUpsSensors(),
      fetchUpsMains(), fetchUpsMetrics(),
    ]);
    setLoading(false);
  }, [
    fetchOutlets,
    fetchPdu, fetchPduOutlets, fetchPduSensors,
    fetchPduMains, fetchPduBranches, fetchPduMetrics,
    fetchUps, fetchUpsOutlets, fetchUpsSensors,
    fetchUpsMains, fetchUpsMetrics,
  ]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleOutletPowerControl = async () => {
    try {
      await apiPost(`${powerDialog.path}/Actions/Outlet.PowerControl`, { PowerState: powerState });
      notify(`${powerDialog.name}: ${powerState} を実行しました`);
      setPowerDialog({ open: false, path: '', name: '' });
      await Promise.all([fetchOutlets(), fetchPduOutlets(), fetchUpsOutlets()]);
    } catch {
      notify('電源操作に失敗しました', 'error');
    }
  };

  const handleSensorSave = async (path: string, reading: number) => {
    try {
      await apiPatch(path, { Reading: reading });
      notify('センサー値を更新しました');
      setSensorDialog(false);
      setEditSensor(null);
      await Promise.all([fetchPduSensors(), fetchUpsSensors()]);
    } catch {
      notify('センサー値の更新に失敗しました', 'error');
    }
  };

  const handlePduPatch = async (field: string, value: unknown) => {
    try {
      const body = field === 'Status' ? { Status: value } : { [field]: value };
      await apiPatch('/redfish/v1/PowerEquipment/RackPDUs/1', body);
      notify('RackPDU を更新しました');
      fetchPdu();
    } catch {
      notify('更新に失敗しました', 'error');
    }
  };

  const handleUpsPatch = async (body: AnyObj) => {
    try {
      await apiPatch('/redfish/v1/PowerEquipment/UPSs/1', body);
      notify('UPS を更新しました');
      fetchUps();
    } catch {
      notify('更新に失敗しました', 'error');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      </AppLayout>
    );
  }

  const OutletTable = ({ outlets, basePath, onRefresh }: {
    outlets: AnyObj[]; basePath: string; onRefresh: () => void;
  }) => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>名前</TableCell>
            <TableCell>電源状態</TableCell>
            <TableCell align="right">電圧 (V)</TableCell>
            <TableCell align="right">電流 (A)</TableCell>
            <TableCell align="right">電力 (W)</TableCell>
            <TableCell>ソケットタイプ</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {outlets.map((o) => (
            <TableRow key={o.Id as string} hover>
              <TableCell>{o.Id as string}</TableCell>
              <TableCell>{o.Name as string}</TableCell>
              <TableCell><PowerStateChip state={o.PowerState as string} /></TableCell>
              <TableCell align="right">
                {(o.Voltage as AnyObj)?.Reading as number ?? (o.CurrentSensorExcerpt as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell align="right">
                {(o.CurrentAmps as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell align="right">
                {(o.PowerWatts as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell>{o.PowerEnabled as string ?? o.OutletType as string ?? '-'}</TableCell>
              <TableCell>
                <Button size="small" variant="outlined" startIcon={<BoltIcon />}
                  onClick={() => {
                    setPowerState('On');
                    setPowerDialog({ open: true, path: `${basePath}/${o.Id}`, name: o.Id as string });
                  }}>
                  Action
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const SensorTable = ({ sensors }: { sensors: AnyObj[] }) => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>名前</TableCell>
            <TableCell align="right">値</TableCell>
            <TableCell>単位</TableCell>
            <TableCell>上限警告</TableCell>
            <TableCell>上限危険</TableCell>
            <TableCell>下限警告</TableCell>
            <TableCell>下限危険</TableCell>
            <TableCell>ステータス</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sensors.map((s) => (
            <TableRow key={s.Id as string} hover>
              <TableCell>{s.Id as string}</TableCell>
              <TableCell>{s.Name as string}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{s.Reading as number}</TableCell>
              <TableCell>{s.ReadingUnits as string}</TableCell>
              <TableCell align="right">{((s.Thresholds as AnyObj)?.UpperCaution as AnyObj)?.Reading as number ?? '-'}</TableCell>
              <TableCell align="right">{((s.Thresholds as AnyObj)?.UpperCritical as AnyObj)?.Reading as number ?? '-'}</TableCell>
              <TableCell align="right">{((s.Thresholds as AnyObj)?.LowerCaution as AnyObj)?.Reading as number ?? '-'}</TableCell>
              <TableCell align="right">{((s.Thresholds as AnyObj)?.LowerCritical as AnyObj)?.Reading as number ?? '-'}</TableCell>
              <TableCell>
                <StatusChip state={(s.Status as AnyObj)?.State as string}
                  health={(s.Status as AnyObj)?.Health as string} />
              </TableCell>
              <TableCell>
                <Button size="small" startIcon={<EditIcon />}
                  onClick={() => { setEditSensor(s); setSensorDialog(true); }}>
                  編集
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const CircuitTable = ({ circuits, label }: { circuits: AnyObj[]; label: string }) => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>名前</TableCell>
            <TableCell align="right">電圧 (V)</TableCell>
            <TableCell align="right">電流 (A)</TableCell>
            <TableCell align="right">電力 (W)</TableCell>
            <TableCell align="right">電力量 (kWh)</TableCell>
            <TableCell>ステータス</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {circuits.map((c) => (
            <TableRow key={c.Id as string} hover>
              <TableCell>{c.Id as string}</TableCell>
              <TableCell>{c.Name as string}</TableCell>
              <TableCell align="right">
                {(c.Voltage as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell align="right">
                {(c.CurrentAmps as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell align="right">
                {(c.PowerWatts as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell align="right">
                {(c.EnergykWh as AnyObj)?.Reading as number ?? '-'}
              </TableCell>
              <TableCell>
                <StatusChip state={(c.Status as AnyObj)?.State as string}
                  health={(c.Status as AnyObj)?.Health as string} />
              </TableCell>
            </TableRow>
          ))}
          {circuits.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">{label} なし</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight="bold">Power Equipment</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2 }}>
        <Tab label="RackPDU" />
        <Tab label="UPS" />
        <Tab label={`Outlets (${outlets.length})`} />
      </Tabs>

      {/* RackPDU */}
      <TabPanel value={mainTab} index={0}>
        {pdu && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>RackPDU 情報 (ID: 1)</Typography>
              <InfoRow label="名前" value={pdu.Name as string} />
              <InfoRow label="メーカー" value={pdu.Manufacturer as string} />
              <InfoRow label="モデル" value={pdu.Model as string} />
              <InfoRow label="シリアル番号" value={pdu.SerialNumber as string} />
              <InfoRow label="定格電力 (kVA)" value={pdu.RatedInputVA as number} />
              <InfoRow label="ステータス" value={
                <StatusChip state={(pdu.Status as AnyObj)?.State as string}
                  health={(pdu.Status as AnyObj)?.Health as string} />} />
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(['OK', 'Warning', 'Critical'] as const).map((h) => (
                  <Button key={h} size="small" variant="outlined"
                    color={h === 'OK' ? 'success' : h === 'Warning' ? 'warning' : 'error'}
                    onClick={() => handlePduPatch('Status', { State: 'Enabled', Health: h })}>
                    Health → {h}
                  </Button>
                ))}
              </Box>
            </Paper>

            <Tabs value={pduTab} onChange={(_, v) => setPduTab(v)}>
              <Tab label={`Outlets (${pduOutlets.length})`} />
              <Tab label={`Sensors (${pduSensors.length})`} />
              <Tab label={`Mains (${pduMains.length})`} />
              <Tab label={`Branches (${pduBranches.length})`} />
              <Tab label="Metrics" />
            </Tabs>

            <TabPanel value={pduTab} index={0}>
              <OutletTable outlets={pduOutlets}
                basePath="/redfish/v1/PowerEquipment/RackPDUs/1/Outlets"
                onRefresh={fetchPduOutlets} />
            </TabPanel>

            <TabPanel value={pduTab} index={1}>
              <SensorTable sensors={pduSensors} />
            </TabPanel>

            <TabPanel value={pduTab} index={2}>
              <CircuitTable circuits={pduMains} label="メイン回路" />
            </TabPanel>

            <TabPanel value={pduTab} index={3}>
              <CircuitTable circuits={pduBranches} label="ブランチ回路" />
            </TabPanel>

            <TabPanel value={pduTab} index={4}>
              {pduMetrics && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>PDU メトリクス</Typography>
                  <InfoRow label="消費電力 (W)" value={(pduMetrics.PowerWatts as AnyObj)?.Reading as number ?? '-'} />
                  <InfoRow label="電力量 (kWh)" value={(pduMetrics.EnergykWh as AnyObj)?.Reading as number ?? '-'} />
                </Paper>
              )}
            </TabPanel>
          </Stack>
        )}
      </TabPanel>

      {/* UPS */}
      <TabPanel value={mainTab} index={1}>
        {ups && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>UPS 情報 (ID: 1)</Typography>
              <InfoRow label="名前" value={ups.Name as string} />
              <InfoRow label="メーカー" value={ups.Manufacturer as string} />
              <InfoRow label="モデル" value={ups.Model as string} />
              <InfoRow label="定格 (VA)" value={ups.RatedInputVA as number} />
              <InfoRow label="ライン入力ステータス" value={ups.LineInputStatus as string} />
              <InfoRow label="バッテリ充電率 (%)" value={(ups.Batteries as AnyObj)?.ChargePercent as number ?? '-'} />
              <InfoRow label="バックアップ推定時間 (分)" value={ups.BackupEstimatedMinutes as number} />
              <InfoRow label="ステータス" value={
                <StatusChip state={(ups.Status as AnyObj)?.State as string}
                  health={(ups.Status as AnyObj)?.Health as string} />} />
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  LineInputStatus を変更:
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>LineInputStatus</InputLabel>
                    <Select value={lineInputStatus} label="LineInputStatus" onChange={(e) => setLineInputStatus(e.target.value as string)}>
                      {['Normal', 'OutOfRange', 'OutOfPower', 'LossOfInput', 'OutOfFrequencyRange'].map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    color={lineInputStatus === 'LossOfInput' || lineInputStatus === 'OutOfPower' ? 'error' : 'primary'}
                    onClick={() => handleUpsPatch({ LineInputStatus: lineInputStatus })}
                  >
                    Apply
                  </Button>
                </Stack>
              </Box>
            </Paper>

            <Tabs value={upsTab} onChange={(_, v) => setUpsTab(v)}>
              <Tab label={`Outlets (${upsOutlets.length})`} />
              <Tab label={`Sensors (${upsSensors.length})`} />
              <Tab label={`Mains (${upsMains.length})`} />
              <Tab label="Metrics" />
            </Tabs>

            <TabPanel value={upsTab} index={0}>
              <OutletTable outlets={upsOutlets}
                basePath="/redfish/v1/PowerEquipment/UPSs/1/Outlets"
                onRefresh={fetchUpsOutlets} />
            </TabPanel>

            <TabPanel value={upsTab} index={1}>
              <SensorTable sensors={upsSensors} />
            </TabPanel>

            <TabPanel value={upsTab} index={2}>
              <CircuitTable circuits={upsMains} label="メイン回路" />
            </TabPanel>

            <TabPanel value={upsTab} index={3}>
              {upsMetrics && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>UPS メトリクス</Typography>
                  <InfoRow label="入力電力 (W)" value={(upsMetrics.InputPowerWatts as AnyObj)?.Reading as number ?? '-'} />
                  <InfoRow label="出力電力 (W)" value={(upsMetrics.OutputPowerWatts as AnyObj)?.Reading as number ?? '-'} />
                  <InfoRow label="バッテリ充電 (%)" value={upsMetrics.BatteryChargePercent as number ?? '-'} />
                  <InfoRow label="バックアップ時間 (分)" value={upsMetrics.BackupEstimatedMinutes as number ?? '-'} />
                </Paper>
              )}
            </TabPanel>
          </Stack>
        )}
      </TabPanel>

      {/* Standalone Outlets */}
      <TabPanel value={mainTab} index={2}>
        <OutletTable outlets={outlets}
          basePath="/redfish/v1/PowerEquipment/Outlets"
          onRefresh={fetchOutlets} />
      </TabPanel>

      {/* Outlet Power Control Dialog */}
      <Dialog open={powerDialog.open} onClose={() => setPowerDialog({ open: false, path: '', name: '' })}
        maxWidth="xs" fullWidth>
        <DialogTitle>電源アクション — {powerDialog.name}</DialogTitle>
        <DialogContent>
          <FormControl size="small" fullWidth sx={{ mt: 1 }}>
            <InputLabel>PowerState</InputLabel>
            <Select value={powerState} label="PowerState" onChange={(e) => setPowerState(e.target.value)}>
              {OUTLET_POWER_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPowerDialog({ open: false, path: '', name: '' })}>キャンセル</Button>
          <Button variant="contained" onClick={handleOutletPowerControl}>実行</Button>
        </DialogActions>
      </Dialog>

      {/* Sensor Edit Dialog */}
      <SensorEditDialog
        open={sensorDialog}
        sensor={editSensor}
        onClose={() => { setSensorDialog(false); setEditSensor(null); }}
        onSave={handleSensorSave}
      />

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}
