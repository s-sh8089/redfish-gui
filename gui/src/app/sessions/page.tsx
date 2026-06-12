'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiDelete, apiGet, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ UserName: '', Password: '' });
  const [newToken, setNewToken] = useState('');

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const col = await apiGet('/redfish/v1/SessionService/Sessions/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setSessions(items as AnyObj[]);
    } catch {
      notify('セッション一覧の取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleCreate = async () => {
    try {
      const res = await apiPost('/redfish/v1/SessionService/Sessions/', loginForm) as AnyObj;
      setNewToken((res?.['X-Auth-Token'] as string) ?? '(レスポンスボディから取得)');
      notify('セッションを作成しました');
      setLoginForm({ UserName: '', Password: '' });
      fetchSessions();
    } catch {
      notify('セッションの作成に失敗しました', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`セッション ${id} を削除しますか？`)) return;
    try {
      await apiDelete(`/redfish/v1/SessionService/Sessions/${id}/`);
      notify('セッションを削除しました');
      fetchSessions();
    } catch {
      notify('セッションの削除に失敗しました', 'error');
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
        <Typography variant="h5" fontWeight="bold">SessionService</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchSessions}>更新</Button>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setCreateOpen(true); setNewToken(''); }}>
          セッション作成
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>名前</TableCell>
              <TableCell>ユーザー名</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.Id as string} hover>
                <TableCell>{s.Id as string}</TableCell>
                <TableCell>{s.Name as string}</TableCell>
                <TableCell>{s.UserName as string}</TableCell>
                <TableCell>
                  <Button size="small" color="error" startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(s.Id as string)}>削除</Button>
                </TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">アクティブなセッションなし</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>セッション作成 (ログイン)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="ユーザー名" size="small" fullWidth value={loginForm.UserName}
              onChange={(e) => setLoginForm((p) => ({ ...p, UserName: e.target.value }))} />
            <TextField label="パスワード" type="password" size="small" fullWidth value={loginForm.Password}
              onChange={(e) => setLoginForm((p) => ({ ...p, Password: e.target.value }))} />
            {newToken && (
              <Box sx={{ p: 1.5, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography variant="caption" display="block" color="success.contrastText">
                  X-Auth-Token:
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}
                  color="success.contrastText">
                  {newToken}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>閉じる</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!loginForm.UserName || !loginForm.Password}>ログイン</Button>
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
