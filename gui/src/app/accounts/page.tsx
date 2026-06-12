'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Select, Snackbar,
  Stack, Switch, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AppLayout from '@/components/AppLayout';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function StatusChip({ enabled, locked }: { enabled: boolean; locked?: boolean }) {
  if (locked) return <Chip label="Locked" color="error" size="small" />;
  return <Chip label={enabled ? '有効' : '無効'} color={enabled ? 'success' : 'default'} size="small" />;
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function AccountsPage() {
  const [tab, setTab] = useState(0);
  const [accounts, setAccounts] = useState<AnyObj[]>([]);
  const [roles, setRoles] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ UserName: '', Password: '', RoleId: 'Operator', Enabled: true, Description: '' });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AnyObj | null>(null);
  const [editForm, setEditForm] = useState({ Password: '', RoleId: '', Enabled: true, Locked: false });

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchAccounts = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/AccountService/Accounts/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setAccounts(items as AnyObj[]);
    } catch {
      notify('アカウント一覧の取得に失敗しました', 'error');
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/AccountService/Roles/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setRoles(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAccounts(), fetchRoles()]);
    setLoading(false);
  }, [fetchAccounts, fetchRoles]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    try {
      await apiPost('/redfish/v1/AccountService/Accounts/', newUser);
      notify('アカウントを作成しました');
      setCreateOpen(false);
      setNewUser({ UserName: '', Password: '', RoleId: 'Operator', Enabled: true, Description: '' });
      fetchAccounts();
    } catch {
      notify('アカウントの作成に失敗しました', 'error');
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const body: AnyObj = { RoleId: editForm.RoleId, Enabled: editForm.Enabled, Locked: editForm.Locked };
    if (editForm.Password) body.Password = editForm.Password;
    try {
      await apiPatch(`/redfish/v1/AccountService/Accounts/${editTarget.Id}/`, body);
      notify('アカウントを更新しました');
      setEditOpen(false);
      fetchAccounts();
    } catch {
      notify('アカウントの更新に失敗しました', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`アカウント ${id} を削除しますか？`)) return;
    try {
      await apiDelete(`/redfish/v1/AccountService/Accounts/${id}/`);
      notify('アカウントを削除しました');
      fetchAccounts();
    } catch {
      notify('アカウントの削除に失敗しました', 'error');
    }
  };

  const openEdit = (acct: AnyObj) => {
    setEditTarget(acct);
    setEditForm({
      Password: '',
      RoleId: (acct.RoleId as string) ?? '',
      Enabled: (acct.Enabled as boolean) ?? true,
      Locked: (acct.Locked as boolean) ?? false,
    });
    setEditOpen(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      </AppLayout>
    );
  }

  const roleIds = roles.map((r) => r.Id as string);

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight="bold">AccountService</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label={`Accounts (${accounts.length})`} />
        <Tab label={`Roles (${roles.length})`} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Box sx={{ mb: 1 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            アカウント追加
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>ユーザー名</TableCell>
                <TableCell>ロール</TableCell>
                <TableCell>説明</TableCell>
                <TableCell>状態</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.Id as string} hover>
                  <TableCell>{a.Id as string}</TableCell>
                  <TableCell>{a.UserName as string}</TableCell>
                  <TableCell>{a.RoleId as string}</TableCell>
                  <TableCell>{(a.Description as string) || '-'}</TableCell>
                  <TableCell>
                    <StatusChip enabled={a.Enabled as boolean} locked={a.Locked as boolean} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(a)}>編集</Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />}
                        onClick={() => handleDelete(a.Id as string)}>削除</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>ロールタイプ</TableCell>
                <TableCell>割り当て可能</TableCell>
                <TableCell>権限</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.Id as string} hover>
                  <TableCell>{r.Id as string}</TableCell>
                  <TableCell>{r.Name as string}</TableCell>
                  <TableCell>{r.RoleType as string}</TableCell>
                  <TableCell>
                    <Chip label={r.IsPredefined ? '事前定義' : 'カスタム'} size="small"
                      color={r.IsPredefined ? 'default' : 'primary'} />
                  </TableCell>
                  <TableCell>
                    {((r.AssignedPrivileges as string[]) ?? []).join(', ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>アカウント作成</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="ユーザー名" size="small" fullWidth value={newUser.UserName}
              onChange={(e) => setNewUser((p) => ({ ...p, UserName: e.target.value }))} />
            <TextField label="パスワード" type="password" size="small" fullWidth value={newUser.Password}
              onChange={(e) => setNewUser((p) => ({ ...p, Password: e.target.value }))} />
            <Select size="small" value={newUser.RoleId}
              onChange={(e) => setNewUser((p) => ({ ...p, RoleId: e.target.value }))}>
              {roleIds.length > 0
                ? roleIds.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)
                : ['Administrator', 'Operator', 'ReadOnly'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
            <TextField label="説明" size="small" fullWidth value={newUser.Description}
              onChange={(e) => setNewUser((p) => ({ ...p, Description: e.target.value }))} />
            <FormControlLabel
              control={<Switch checked={newUser.Enabled}
                onChange={(e) => setNewUser((p) => ({ ...p, Enabled: e.target.checked }))} />}
              label="有効"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!newUser.UserName || !newUser.Password}>作成</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>アカウント編集 — {editTarget?.UserName as string}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="新しいパスワード (空白=変更なし)" type="password" size="small" fullWidth
              value={editForm.Password}
              onChange={(e) => setEditForm((p) => ({ ...p, Password: e.target.value }))} />
            <Select size="small" value={editForm.RoleId}
              onChange={(e) => setEditForm((p) => ({ ...p, RoleId: e.target.value }))}>
              {roleIds.length > 0
                ? roleIds.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)
                : ['Administrator', 'Operator', 'ReadOnly'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
            <FormControlLabel
              control={<Switch checked={editForm.Enabled}
                onChange={(e) => setEditForm((p) => ({ ...p, Enabled: e.target.checked }))} />}
              label="有効"
            />
            <FormControlLabel
              control={<Switch checked={editForm.Locked}
                onChange={(e) => setEditForm((p) => ({ ...p, Locked: e.target.checked }))} />}
              label="ロック"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleEdit}>更新</Button>
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
