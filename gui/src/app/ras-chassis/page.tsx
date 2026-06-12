'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from '@mui/material';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function StatusChip({ state, health }: { state?: string; health?: string }) {
  const color = health === 'OK' ? 'success' : health === 'Warning' ? 'warning' : 'error';
  return <Chip label={`${state ?? '-'} / ${health ?? '-'}`} color={color} size="small" />;
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

const CHASSIS_ID = 'Rack1';

export default function RasChassisPage() {
  const [tab, setTab] = useState(0);
  const [chassis, setChassis] = useState<AnyObj | null>(null);
  const [sensors, setSensors] = useState<AnyObj[]>([]);
  const [power, setPower] = useState<AnyObj | null>(null);
  const [thermal, setThermal] = useState<AnyObj | null>(null);
  const [logEntries, setLogEntries] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const [sensorDialog, setSensorDialog] = useState(false);
  const [editSensor, setEditSensor] = useState<AnyObj | null>(null);
  const [newReading, setNewReading] = useState('');

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchChassis = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/Chassis') as AnyObj;
      const members = (col.Members ?? []) as AnyObj[];
      if (members.length > 0) {
        const data = await apiGet(members[0]['@odata.id'] as string) as AnyObj;
        setChassis(data);
      }
    } catch {
      notify('Chassis 情報の取得に失敗しました', 'error');
    }
  }, []);

  const fetchSensors = useCallback(async () => {
    try {
      const col = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/Sensors`) as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setSensors(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchPower = useCallback(async () => {
    try {
      const data = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/Power`) as AnyObj;
      setPower(data);
    } catch { /* ignore */ }
  }, []);

  const fetchThermal = useCallback(async () => {
    try {
      const data = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/Thermal`) as AnyObj;
      setThermal(data);
    } catch { /* ignore */ }
  }, []);

  const fetchLogEntries = useCallback(async () => {
    try {
      const col = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/LogServices/Log/Entries`) as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setLogEntries(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchChassis(), fetchSensors(), fetchPower(), fetchThermal(), fetchLogEntries()]);
    setLoading(false);
  }, [fetchChassis, fetchSensors, fetchPower, fetchThermal, fetchLogEntries]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSensorSave = async () => {
    if (!editSensor) return;
    try {
      await apiPatch(editSensor['@odata.id'] as string, { Reading: parseFloat(newReading) });
      notify('センサー値を更新しました');
      setSensorDialog(false);
      setEditSensor(null);
      fetchSensors();
    } catch {
      notify('センサー値の更新に失敗しました', 'error');
    }
  };

  const handleClearLog = async () => {
    if (!confirm('ログをクリアしますか？')) return;
    try {
      await apiPost(`/redfish/v1/Chassis/${CHASSIS_ID}/LogServices/Log/Actions/LogService.ClearLog`, {});
      notify('ログをクリアしました');
      fetchLogEntries();
    } catch {
      notify('クリアに失敗しました', 'error');
    }
  };

  const handleChassisHealthPatch = async (health: string) => {
    const chassisId = (chassis?.Id as string) ?? CHASSIS_ID;
    try {
      await apiPatch(`/redfish/v1/Chassis/${chassisId}`, { Status: { State: 'Enabled', Health: health } });
      notify(`Health を ${health} に変更しました`);
      fetchChassis();
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

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight="bold">Chassis (RAS-EMU)</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Overview" />
        <Tab label={`Sensors (${sensors.length})`} />
        <Tab label="Power" />
        <Tab label="Thermal" />
        <Tab label={`Log (${logEntries.length})`} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {chassis && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>シャーシ情報</Typography>
            <InfoRow label="ID" value={chassis.Id as string} />
            <InfoRow label="名前" value={chassis.Name as string} />
            <InfoRow label="タイプ" value={chassis.ChassisType as string} />
            <InfoRow label="U サイズ" value={`${chassis.HeightMm as number ?? '-'} mm`} />
            <InfoRow label="ステータス" value={
              <StatusChip state={(chassis.Status as AnyObj)?.State as string}
                health={(chassis.Status as AnyObj)?.Health as string} />} />
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Health を変更:
              </Typography>
              <Stack direction="row" spacing={1}>
                {(['OK', 'Warning', 'Critical'] as const).map((h) => (
                  <Button key={h} size="small" variant="outlined"
                    color={h === 'OK' ? 'success' : h === 'Warning' ? 'warning' : 'error'}
                    onClick={() => handleChassisHealthPatch(h)}>
                    {h}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell align="right">値</TableCell>
                <TableCell>単位</TableCell>
                <TableCell>タイプ</TableCell>
                <TableCell>上限警告</TableCell>
                <TableCell>上限危険</TableCell>
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
                  <TableCell>{s.ReadingType as string}</TableCell>
                  <TableCell align="right">
                    {((s.Thresholds as AnyObj)?.UpperCaution as AnyObj)?.Reading as number ?? '-'}
                  </TableCell>
                  <TableCell align="right">
                    {((s.Thresholds as AnyObj)?.UpperCritical as AnyObj)?.Reading as number ?? '-'}
                  </TableCell>
                  <TableCell>
                    <StatusChip state={(s.Status as AnyObj)?.State as string}
                      health={(s.Status as AnyObj)?.Health as string} />
                  </TableCell>
                  <TableCell>
                    <Button size="small" startIcon={<EditIcon />}
                      onClick={() => {
                        setEditSensor(s);
                        setNewReading(String(s.Reading ?? ''));
                        setSensorDialog(true);
                      }}>
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        {power && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>電力情報</Typography>
            <InfoRow label="消費電力 (W)" value={power.PowerConsumedWatts as number ?? '-'} />
            <InfoRow label="電力容量 (W)" value={power.PowerCapacityWatts as number ?? '-'} />
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={tab} index={3}>
        {thermal && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>温度</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>名前</TableCell>
                      <TableCell align="right">現在値 (°C)</TableCell>
                      <TableCell align="right">警告閾値 (°C)</TableCell>
                      <TableCell>ステータス</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {((thermal.Temperatures ?? []) as AnyObj[]).map((t) => (
                      <TableRow key={t.MemberId as string} hover>
                        <TableCell>{t.Name as string}</TableCell>
                        <TableCell align="right">{t.ReadingCelsius as number}</TableCell>
                        <TableCell align="right">{t.UpperThresholdNonCritical as number ?? '-'}</TableCell>
                        <TableCell>
                          <StatusChip state={(t.Status as AnyObj)?.State as string}
                            health={(t.Status as AnyObj)?.Health as string} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>湿度</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>名前</TableCell>
                      <TableCell align="right">現在値 (%)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {((thermal.Humidity ?? []) as AnyObj[]).map((h, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{h.Name as string}</TableCell>
                        <TableCell align="right">{h.Reading as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Stack>
        )}
      </TabPanel>

      {/* Log */}
      <TabPanel value={tab} index={4}>
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

      {/* Sensor Edit Dialog */}
      <Dialog open={sensorDialog} onClose={() => setSensorDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>センサー値更新 — {editSensor?.Name as string}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth size="small" label="Reading" type="number" sx={{ mt: 1 }}
            value={newReading} onChange={(e) => setNewReading(e.target.value)}
            helperText={`単位: ${editSensor?.ReadingUnits as string ?? '-'}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSensorDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSensorSave} disabled={!newReading}>保存</Button>
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
