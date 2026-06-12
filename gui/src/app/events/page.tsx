'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Paper, Select, Snackbar, Stack, Tab,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SendIcon from '@mui/icons-material/Send';
import StreamIcon from '@mui/icons-material/Stream';
import AppLayout from '@/components/AppLayout';
import { apiDelete, apiGet, apiPatch, apiPost, getAuthHeaders } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const EVENT_TYPES = ['Alert', 'StatusChange', 'ResourceUpdated', 'ResourceAdded', 'ResourceRemoved'];
const SEVERITIES = ['OK', 'Warning', 'Critical'];
const REPORT_DEF_TYPES = ['Periodic', 'OnChange', 'OnRequest'];
const REPORT_ACTIONS = ['LogToMetricReportsCollection', 'RedfishEvent'];

const INTERVAL_PRESETS = [
  { label: '10秒', value: 'PT10S' },
  { label: '30秒', value: 'PT30S' },
  { label: '1分', value: 'PT1M' },
  { label: '5分', value: 'PT5M' },
  { label: '15分', value: 'PT15M' },
];

export default function EventsPage() {
  const [tab, setTab] = useState(0);
  const [service, setService] = useState<AnyObj | null>(null);
  const [subscriptions, setSubscriptions] = useState<AnyObj[]>([]);
  const [telemetryDefs, setTelemetryDefs] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  // Subscription state
  const [createOpen, setCreateOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    Destination: '', Context: 'my-context', Protocol: 'Redfish', EventTypes: ['Alert'],
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editSub, setEditSub] = useState<AnyObj | null>(null);
  const [editEventTypes, setEditEventTypes] = useState<string[]>([]);
  const [testOpen, setTestOpen] = useState(false);
  const [testForm, setTestForm] = useState({
    EventType: 'Alert', Severity: 'Critical',
    Message: 'Test event from Redfish GUI', MessageId: 'Base.1.0.GeneralError',
  });

  // Telemetry state
  const [telCreateOpen, setTelCreateOpen] = useState(false);
  const [telForm, setTelForm] = useState({
    Name: '',
    MetricReportDefinitionType: 'Periodic',
    ReportInterval: 'PT30S',
    ReportActions: ['LogToMetricReportsCollection'] as string[],
    metricProperties: [''] as string[],
  });

  // SSE state
  const [sseActive, setSseActive] = useState(false);
  const [sseMessages, setSseMessages] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sseLogRef = useRef<HTMLDivElement | null>(null);

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchService = useCallback(async () => {
    try {
      const data = await apiGet('/redfish/v1/EventService/') as AnyObj;
      setService(data);
    } catch { /* ignore */ }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/EventService/Subscriptions/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setSubscriptions(items as AnyObj[]);
    } catch {
      notify('サブスクリプション一覧の取得に失敗しました', 'error');
    }
  }, []);

  const fetchTelemetryDefs = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/TelemetryService/MetricReportDefinitions/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setTelemetryDefs(items as AnyObj[]);
    } catch { /* TelemetryService が未実装のエミュレータでは無視 */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchService(), fetchSubscriptions(), fetchTelemetryDefs()]);
    setLoading(false);
  }, [fetchService, fetchSubscriptions, fetchTelemetryDefs]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (sseLogRef.current) {
      sseLogRef.current.scrollTop = sseLogRef.current.scrollHeight;
    }
  }, [sseMessages]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // --- Subscription handlers ---
  const handleCreateSub = async () => {
    try {
      await apiPost('/redfish/v1/EventService/Subscriptions/', subForm);
      notify('サブスクリプションを作成しました');
      setCreateOpen(false);
      setSubForm({ Destination: '', Context: 'my-context', Protocol: 'Redfish', EventTypes: ['Alert'] });
      fetchSubscriptions();
    } catch {
      notify('サブスクリプションの作成に失敗しました', 'error');
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm(`サブスクリプション ${id} を削除しますか？`)) return;
    try {
      await apiDelete(`/redfish/v1/EventService/Subscriptions/${id}/`);
      notify('サブスクリプションを削除しました');
      fetchSubscriptions();
    } catch {
      notify('削除に失敗しました', 'error');
    }
  };

  const handleEditSub = async () => {
    if (!editSub) return;
    try {
      await apiPatch(`/redfish/v1/EventService/Subscriptions/${editSub.Id as string}/`, {
        EventTypes: editEventTypes,
      });
      notify('サブスクリプションを更新しました');
      setEditOpen(false);
      fetchSubscriptions();
    } catch {
      notify('更新に失敗しました', 'error');
    }
  };

  const handleTestEvent = async () => {
    try {
      await apiPost('/redfish/v1/EventService/Actions/EventService.SubmitTestEvent', testForm);
      notify('テストイベントを送信しました');
      setTestOpen(false);
    } catch {
      notify('テストイベントの送信に失敗しました', 'error');
    }
  };

  // --- Telemetry handlers ---
  const handleCreateTelemetry = async () => {
    const props = telForm.metricProperties.filter((p) => p.trim() !== '');
    const body: AnyObj = {
      Name: telForm.Name,
      MetricReportDefinitionType: telForm.MetricReportDefinitionType,
      ReportActions: telForm.ReportActions,
      ...(telForm.MetricReportDefinitionType === 'Periodic' && {
        ReportInterval: telForm.ReportInterval,
      }),
      ...(props.length > 0 && {
        Metrics: [{ MetricProperties: props }],
      }),
    };
    try {
      await apiPost('/redfish/v1/TelemetryService/MetricReportDefinitions/', body);
      notify('Telemetry 定義を作成しました');
      setTelCreateOpen(false);
      setTelForm({
        Name: '',
        MetricReportDefinitionType: 'Periodic',
        ReportInterval: 'PT30S',
        ReportActions: ['LogToMetricReportsCollection'],
        metricProperties: [''],
      });
      fetchTelemetryDefs();
    } catch {
      notify('Telemetry 定義の作成に失敗しました', 'error');
    }
  };

  const handleDeleteTelemetry = async (id: string) => {
    if (!confirm(`MetricReportDefinition ${id} を削除しますか？`)) return;
    try {
      await apiDelete(`/redfish/v1/TelemetryService/MetricReportDefinitions/${id}/`);
      notify('Telemetry 定義を削除しました');
      fetchTelemetryDefs();
    } catch {
      notify('削除に失敗しました', 'error');
    }
  };

  // --- SSE handler ---
  const handleSseConnect = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setSseActive(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setSseActive(true);
    setSseMessages((m) => [...m, `[${new Date().toISOString()}] 接続中...`]);
    try {
      const res = await fetch('/api/proxy/emu/redfish/v1/EventService/SSE', {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setSseMessages((m) => [...m, `[${new Date().toISOString()}] 接続エラー: HTTP ${res.status}`]);
        setSseActive(false);
        abortRef.current = null;
        return;
      }
      setSseMessages((m) => [...m.slice(0, -1), `[${new Date().toISOString()}] 接続しました`]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            setSseMessages((m) => [...m, `[${new Date().toISOString()}] ${line.slice(5).trim()}`]);
          }
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setSseMessages((m) => [...m, `[${new Date().toISOString()}] 接続エラー / 切断`]);
      }
    } finally {
      setSseActive(false);
      abortRef.current = null;
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
        <Typography variant="h5" fontWeight="bold">EventService</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Overview" />
        <Tab label={`Subscriptions (${subscriptions.length})`} />
        <Tab label={`Telemetry (${telemetryDefs.length})`} />
        <Tab label="SSE" />
      </Tabs>

      {/* Overview */}
      <TabPanel value={tab} index={0}>
        {service && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>EventService 情報</Typography>
            <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', fontWeight: 500 }}>
                サービス有効
              </Typography>
              <Chip label={service.ServiceEnabled ? '有効' : '無効'}
                color={service.ServiceEnabled ? 'success' : 'default'} size="small" />
            </Box>
            <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', fontWeight: 500 }}>
                配信再試行回数
              </Typography>
              <Typography variant="body2">{service.DeliveryRetryAttempts as number}</Typography>
            </Box>
            <Box sx={{ display: 'flex', py: 0.75 }}>
              <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', fontWeight: 500 }}>
                再試行間隔 (秒)
              </Typography>
              <Typography variant="body2">{service.DeliveryRetryIntervalSeconds as number}</Typography>
            </Box>
          </Paper>
        )}
        <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setTestOpen(true)}>
          テストイベント送信
        </Button>
      </TabPanel>

      {/* Subscriptions */}
      <TabPanel value={tab} index={1}>
        <Box sx={{ mb: 1 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            サブスクリプション追加
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>送信先 URL</TableCell>
                <TableCell>コンテキスト</TableCell>
                <TableCell>イベントタイプ</TableCell>
                <TableCell>状態</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscriptions.map((s) => (
                <TableRow key={s.Id as string} hover>
                  <TableCell>{s.Id as string}</TableCell>
                  <TableCell>{s.Name as string}</TableCell>
                  <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>
                    {s.Destination as string}
                  </TableCell>
                  <TableCell>{s.Context as string}</TableCell>
                  <TableCell>
                    {((s.EventTypes as string[]) ?? []).map((et) => (
                      <Chip key={et} label={et} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={(s.Status as AnyObj)?.State as string ?? 'Unknown'}
                      color={(s.Status as AnyObj)?.State === 'Enabled' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" startIcon={<EditIcon />}
                        onClick={() => {
                          setEditSub(s);
                          setEditEventTypes((s.EventTypes as string[]) ?? []);
                          setEditOpen(true);
                        }}>
                        編集
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteSub(s.Id as string)}>削除</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">サブスクリプションなし</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Telemetry */}
      <TabPanel value={tab} index={2}>
        <Box sx={{ mb: 1 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setTelCreateOpen(true)}>
            MetricReportDefinition 追加
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>タイプ</TableCell>
                <TableCell>収集間隔</TableCell>
                <TableCell>ReportActions</TableCell>
                <TableCell>状態</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {telemetryDefs.map((d) => (
                <TableRow key={d.Id as string} hover>
                  <TableCell>{d.Id as string}</TableCell>
                  <TableCell>{d.Name as string}</TableCell>
                  <TableCell>
                    <Chip label={d.MetricReportDefinitionType as string} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{(d.ReportInterval as string) ?? '—'}</TableCell>
                  <TableCell>
                    {((d.ReportActions as string[]) ?? []).map((a) => (
                      <Chip key={a} label={a} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={(d.Status as AnyObj)?.State as string ?? 'Unknown'}
                      color={(d.Status as AnyObj)?.State === 'Enabled' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="small" color="error" startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteTelemetry(d.Id as string)}>削除</Button>
                  </TableCell>
                </TableRow>
              ))}
              {telemetryDefs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">MetricReportDefinition なし</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* SSE */}
      <TabPanel value={tab} index={3}>
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Button
              variant={sseActive ? 'contained' : 'outlined'}
              color={sseActive ? 'error' : 'primary'}
              startIcon={<StreamIcon />}
              onClick={handleSseConnect}
            >
              {sseActive ? '切断' : '接続'}
            </Button>
            <Chip label={sseActive ? '接続中' : '未接続'} color={sseActive ? 'success' : 'default'} size="small" />
            {sseMessages.length > 0 && (
              <Button size="small" onClick={() => setSseMessages([])}>ログクリア</Button>
            )}
          </Box>
          <Box
            ref={sseLogRef}
            sx={{
              bgcolor: '#1a1a1a', color: '#00ff00', fontFamily: 'monospace',
              fontSize: '0.75rem', p: 2, borderRadius: 1,
              height: 400, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}
          >
            {sseMessages.length === 0
              ? '「接続」をクリックして SSE ストリームを開始してください...'
              : sseMessages.join('\n')}
          </Box>
        </Paper>
      </TabPanel>

      {/* Create Subscription Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>サブスクリプション作成</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="送信先 URL" size="small" fullWidth placeholder="http://your-server/webhook"
              value={subForm.Destination}
              onChange={(e) => setSubForm((p) => ({ ...p, Destination: e.target.value }))} />
            <TextField label="コンテキスト" size="small" fullWidth value={subForm.Context}
              onChange={(e) => setSubForm((p) => ({ ...p, Context: e.target.value }))} />
            <Box>
              <Typography variant="caption" color="text.secondary">イベントタイプ</Typography>
              <Select multiple size="small" fullWidth value={subForm.EventTypes}
                onChange={(e) => setSubForm((p) => ({ ...p, EventTypes: e.target.value as string[] }))}
                renderValue={(sel) => (sel as string[]).join(', ')}>
                {EVENT_TYPES.map((et) => <MenuItem key={et} value={et}>{et}</MenuItem>)}
              </Select>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleCreateSub} disabled={!subForm.Destination}>作成</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>サブスクリプション編集 — {editSub?.Id as string}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">イベントタイプ</Typography>
              <Select multiple size="small" fullWidth value={editEventTypes}
                onChange={(e) => setEditEventTypes(e.target.value as string[])}
                renderValue={(sel) => (sel as string[]).join(', ')}>
                {EVENT_TYPES.map((et) => <MenuItem key={et} value={et}>{et}</MenuItem>)}
              </Select>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleEditSub}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Test Event Dialog */}
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>テストイベント送信</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">イベントタイプ</Typography>
              <Select size="small" fullWidth value={testForm.EventType}
                onChange={(e) => setTestForm((p) => ({ ...p, EventType: e.target.value }))}>
                {EVENT_TYPES.map((et) => <MenuItem key={et} value={et}>{et}</MenuItem>)}
              </Select>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">重大度</Typography>
              <Select size="small" fullWidth value={testForm.Severity}
                onChange={(e) => setTestForm((p) => ({ ...p, Severity: e.target.value }))}>
                {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </Box>
            <TextField label="メッセージ" size="small" fullWidth value={testForm.Message}
              onChange={(e) => setTestForm((p) => ({ ...p, Message: e.target.value }))} />
            <TextField label="MessageId" size="small" fullWidth value={testForm.MessageId}
              onChange={(e) => setTestForm((p) => ({ ...p, MessageId: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>キャンセル</Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleTestEvent}>送信</Button>
        </DialogActions>
      </Dialog>

      {/* Create Telemetry Dialog */}
      <Dialog open={telCreateOpen} onClose={() => setTelCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>MetricReportDefinition 作成</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="名前" size="small" fullWidth
              value={telForm.Name}
              onChange={(e) => setTelForm((p) => ({ ...p, Name: e.target.value }))}
            />
            <Box>
              <Typography variant="caption" color="text.secondary">タイプ</Typography>
              <Select size="small" fullWidth value={telForm.MetricReportDefinitionType}
                onChange={(e) => setTelForm((p) => ({ ...p, MetricReportDefinitionType: e.target.value }))}>
                {REPORT_DEF_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </Box>
            {telForm.MetricReportDefinitionType === 'Periodic' && (
              <Box>
                <Typography variant="caption" color="text.secondary">収集間隔 (ISO 8601)</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, mb: 0.5 }}>
                  {INTERVAL_PRESETS.map((p) => (
                    <Chip
                      key={p.value}
                      label={p.label}
                      size="small"
                      variant={telForm.ReportInterval === p.value ? 'filled' : 'outlined'}
                      color={telForm.ReportInterval === p.value ? 'primary' : 'default'}
                      onClick={() => setTelForm((prev) => ({ ...prev, ReportInterval: p.value }))}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
                <TextField
                  size="small" fullWidth placeholder="PT30S"
                  value={telForm.ReportInterval}
                  onChange={(e) => setTelForm((p) => ({ ...p, ReportInterval: e.target.value }))}
                />
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">ReportActions</Typography>
              <Select multiple size="small" fullWidth value={telForm.ReportActions}
                onChange={(e) => setTelForm((p) => ({ ...p, ReportActions: e.target.value as string[] }))}
                renderValue={(sel) => (sel as string[]).join(', ')}>
                {REPORT_ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                MetricProperties（監視対象プロパティ URI）
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {telForm.metricProperties.map((prop, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="/redfish/v1/Chassis/1/Power#/PowerConsumedWatts"
                      value={prop}
                      onChange={(e) => {
                        const next = [...telForm.metricProperties];
                        next[i] = e.target.value;
                        setTelForm((p) => ({ ...p, metricProperties: next }));
                      }}
                    />
                    <IconButton
                      size="small"
                      disabled={telForm.metricProperties.length === 1}
                      onClick={() => {
                        const next = telForm.metricProperties.filter((_, idx) => idx !== i);
                        setTelForm((p) => ({ ...p, metricProperties: next }));
                      }}
                    >
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setTelForm((p) => ({ ...p, metricProperties: [...p.metricProperties, ''] }))}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  プロパティ追加
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTelCreateOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleCreateTelemetry}
            disabled={!telForm.Name || telForm.ReportActions.length === 0}
          >
            作成
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
