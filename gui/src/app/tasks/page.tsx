'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiDelete, apiGet } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function TaskStateChip({ state }: { state: string }) {
  const color =
    state === 'Completed' ? 'success' :
    state === 'Running' ? 'info' :
    state === 'Exception' ? 'error' :
    state === 'Killed' ? 'warning' : 'default';
  return <Chip label={state ?? '-'} color={color} size="small" />;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState<AnyObj | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const col = await apiGet('/redfish/v1/TaskService/Tasks/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setTasks(items as AnyObj[]);
    } catch {
      notify('タスク一覧の取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleDelete = async (id: string) => {
    if (!confirm(`タスク ${id} を削除しますか？`)) return;
    try {
      await apiDelete(`/redfish/v1/TaskService/Tasks/${id}/`);
      notify('タスクを削除しました');
      fetchTasks();
    } catch {
      notify('削除に失敗しました', 'error');
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
        <Typography variant="h5" fontWeight="bold">TaskService</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchTasks}>更新</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>名前</TableCell>
              <TableCell>状態</TableCell>
              <TableCell>開始時刻</TableCell>
              <TableCell>終了時刻</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.Id as string} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{t.Id as string}</TableCell>
                <TableCell>{t.Name as string}</TableCell>
                <TableCell><TaskStateChip state={t.TaskState as string} /></TableCell>
                <TableCell>{t.StartTime as string ?? '-'}</TableCell>
                <TableCell>{t.EndTime as string ?? '-'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<InfoIcon />}
                      onClick={() => setDetailTask(t)}>
                      詳細
                    </Button>
                    <Button size="small" color="error" startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(t.Id as string)}>
                      削除
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">タスクなし</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!detailTask} onClose={() => setDetailTask(null)} maxWidth="sm" fullWidth>
        <DialogTitle>タスク詳細 — {detailTask?.Id as string}</DialogTitle>
        <DialogContent>
          {detailTask && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {Object.entries(detailTask)
                .filter(([k]) => !k.startsWith('@'))
                .map(([k, v]) => (
                  <Box key={k} sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ width: 180, color: 'text.secondary', fontWeight: 500, flexShrink: 0 }}>
                      {k}
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-')}
                    </Typography>
                  </Box>
                ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailTask(null)}>閉じる</Button>
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
