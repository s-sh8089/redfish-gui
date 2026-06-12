'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  FormControl, InputLabel, MenuItem, Paper, Select,
  Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost } from '@/lib/api';

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

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const CHASSIS_ID = 'chassis1';
const RESET_TYPES = ['On', 'ForceOff', 'PowerCycle'];

export default function ChassisPage() {
  const [tab, setTab] = useState(0);
  const [chassis, setChassis] = useState<AnyObj | null>(null);
  const [thermal, setThermal] = useState<AnyObj | null>(null);
  const [power, setPower] = useState<AnyObj | null>(null);
  const [sensors, setSensors] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const [resetType, setResetType] = useState(RESET_TYPES[0]);

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchChassis = useCallback(async () => {
    try {
      const data = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/`) as AnyObj;
      setChassis(data);
    } catch {
      notify('Chassis 情報の取得に失敗しました', 'error');
    }
  }, []);

  const fetchThermal = useCallback(async () => {
    try {
      const data = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/Thermal/`) as AnyObj;
      setThermal(data);
    } catch { /* ignore */ }
  }, []);

  const fetchPower = useCallback(async () => {
    try {
      const data = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/Power/`) as AnyObj;
      setPower(data);
    } catch { /* ignore */ }
  }, []);

  const fetchSensors = useCallback(async () => {
    try {
      const col = await apiGet(`/redfish/v1/Chassis/${CHASSIS_ID}/Sensors/`) as AnyObj;
      const items = await Promise.all(
        (col.Members ?? []).map((m: AnyObj) => apiGet(m['@odata.id']))
      );
      setSensors(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchChassis(), fetchThermal(), fetchPower(), fetchSensors()]);
    setLoading(false);
  }, [fetchChassis, fetchThermal, fetchPower, fetchSensors]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleReset = async (resetType: string) => {
    try {
      await apiPost(`/redfish/v1/Chassis/${CHASSIS_ID}/Actions/Chassis.Reset`, { ResetType: resetType });
      notify(`${resetType} を実行しました`);
      setTimeout(fetchChassis, 500);
    } catch {
      notify('操作に失敗しました', 'error');
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
        <Typography variant="h5" fontWeight="bold">Chassis</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Overview" />
        <Tab label={`Thermal (${(thermal?.Temperatures ?? []).length + (thermal?.Fans ?? []).length})`} />
        <Tab label="Power" />
        <Tab label={`Sensors (${sensors.length})`} />
      </Tabs>

      {/* Overview */}
      <TabPanel value={tab} index={0}>
        {chassis && (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">シャーシ情報</Typography>
              <InfoRow label="ID" value={chassis.Id} />
              <InfoRow label="タイプ" value={chassis.ChassisType} />
              <InfoRow label="電源状態" value={<PowerChip state={chassis.PowerState} />} />
              <InfoRow label="ステータス" value={<StatusChip state={chassis.Status?.State} health={chassis.Status?.Health} />} />
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
                  color={resetType === 'ForceOff' ? 'error' : 'primary'}
                  onClick={() => handleReset(resetType)}
                >
                  Apply
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}
      </TabPanel>

      {/* Thermal */}
      <TabPanel value={tab} index={1}>
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">温度センサー</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell align="right">現在値 (°C)</TableCell>
                    <TableCell align="right">警告閾値 (°C)</TableCell>
                    <TableCell align="right">危険閾値 (°C)</TableCell>
                    <TableCell>ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(thermal?.Temperatures ?? []).map((t: AnyObj) => (
                    <TableRow key={t.MemberId} hover>
                      <TableCell>{t.MemberId}</TableCell>
                      <TableCell>{t.Name}</TableCell>
                      <TableCell align="right">{t.ReadingCelsius}</TableCell>
                      <TableCell align="right">{t.UpperThresholdNonCritical ?? '-'}</TableCell>
                      <TableCell align="right">{t.UpperThresholdCritical ?? '-'}</TableCell>
                      <TableCell><StatusChip state={t.Status?.State} health={t.Status?.Health} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">ファン</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell align="right">回転数</TableCell>
                    <TableCell>単位</TableCell>
                    <TableCell>ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(thermal?.Fans ?? []).map((f: AnyObj) => (
                    <TableRow key={f.MemberId} hover>
                      <TableCell>{f.MemberId}</TableCell>
                      <TableCell>{f.Name}</TableCell>
                      <TableCell align="right">{f.Reading?.toLocaleString()}</TableCell>
                      <TableCell>{f.ReadingUnits}</TableCell>
                      <TableCell><StatusChip state={f.Status?.State} health={f.Status?.Health} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </TabPanel>

      {/* Power */}
      <TabPanel value={tab} index={2}>
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">電力消費</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>名前</TableCell>
                    <TableCell align="right">現在 (W)</TableCell>
                    <TableCell align="right">平均 (W)</TableCell>
                    <TableCell align="right">最小 (W)</TableCell>
                    <TableCell align="right">最大 (W)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(power?.PowerControl ?? []).map((pc: AnyObj) => (
                    <TableRow key={pc.MemberId} hover>
                      <TableCell>{pc.Name}</TableCell>
                      <TableCell align="right">{pc.PowerConsumedWatts}</TableCell>
                      <TableCell align="right">{pc.PowerMetrics?.AverageConsumedWatts}</TableCell>
                      <TableCell align="right">{pc.PowerMetrics?.MinConsumedWatts}</TableCell>
                      <TableCell align="right">{pc.PowerMetrics?.MaxConsumedWatts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">電源ユニット</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>メーカー</TableCell>
                    <TableCell>モデル</TableCell>
                    <TableCell>ファームウェア</TableCell>
                    <TableCell>シリアル番号</TableCell>
                    <TableCell align="right">入力電圧 (V)</TableCell>
                    <TableCell>ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(power?.PowerSupplies ?? []).map((ps: AnyObj) => (
                    <TableRow key={ps.MemberId} hover>
                      <TableCell>{ps.MemberId}</TableCell>
                      <TableCell>{ps.Manufacturer}</TableCell>
                      <TableCell>{ps.Model}</TableCell>
                      <TableCell>{ps.FirmwareVersion}</TableCell>
                      <TableCell>{ps.SerialNumber}</TableCell>
                      <TableCell align="right">{ps.LineInputVoltage}</TableCell>
                      <TableCell><StatusChip state={ps.Status?.State} health={ps.Status?.Health} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">電圧</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell align="right">現在値 (V)</TableCell>
                    <TableCell>物理コンテキスト</TableCell>
                    <TableCell>ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(power?.Voltages ?? []).map((v: AnyObj) => (
                    <TableRow key={v.MemberId} hover>
                      <TableCell>{v.MemberId}</TableCell>
                      <TableCell>{v.Name}</TableCell>
                      <TableCell align="right">{v.ReadingVolts}</TableCell>
                      <TableCell>{v.PhysicalContext}</TableCell>
                      <TableCell><StatusChip state={v.Status?.State} health={v.Status?.Health} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </TabPanel>

      {/* Sensors */}
      <TabPanel value={tab} index={3}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell align="right">値</TableCell>
                <TableCell>単位</TableCell>
                <TableCell>タイプ</TableCell>
                <TableCell>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sensors.map((s) => (
                <TableRow key={s.Id} hover>
                  <TableCell>{s.Id}</TableCell>
                  <TableCell>{s.Name}</TableCell>
                  <TableCell align="right">{s.Reading}</TableCell>
                  <TableCell>{s.ReadingUnits}</TableCell>
                  <TableCell>{s.ReadingType}</TableCell>
                  <TableCell><StatusChip state={s.Status?.State} health={s.Status?.Health} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}
