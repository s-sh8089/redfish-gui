'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function UpdatePage() {
  const [tab, setTab] = useState(0);
  const [firmware, setFirmware] = useState<AnyObj[]>([]);
  const [software, setSoftware] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ ImageURI: '', Targets: '' });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchFirmware = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/UpdateService/FirmwareInventory/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setFirmware(items as AnyObj[]);
    } catch {
      notify('ファームウェア一覧の取得に失敗しました', 'error');
    }
  }, []);

  const fetchSoftware = useCallback(async () => {
    try {
      const col = await apiGet('/redfish/v1/UpdateService/SoftwareInventory/') as AnyObj;
      const items = await Promise.all(
        ((col.Members ?? []) as AnyObj[]).map((m) => apiGet(m['@odata.id'] as string))
      );
      setSoftware(items as AnyObj[]);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchFirmware(), fetchSoftware()]);
    setLoading(false);
  }, [fetchFirmware, fetchSoftware]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSimpleUpdate = async () => {
    const body: AnyObj = { ImageURI: updateForm.ImageURI };
    if (updateForm.Targets.trim()) {
      body.Targets = updateForm.Targets.split(',').map((t) => t.trim()).filter(Boolean);
    }
    try {
      await apiPost('/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate', body);
      notify('SimpleUpdate を実行しました');
      setUpdateOpen(false);
      setUpdateForm({ ImageURI: '', Targets: '' });
    } catch {
      notify('SimpleUpdate に失敗しました', 'error');
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
      const host = process.env.NEXT_PUBLIC_EMU_HOST ?? 'localhost';
      const port = process.env.NEXT_PUBLIC_EMU_PORT ?? '8008';
      const res = await fetch(`${protocol}//${host}:${port}/redfish/v1/UpdateService/update`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${text}`);
      }
      notify('ファームウェアのアップロードを開始しました');
    } catch (e) {
      notify(`アップロードに失敗しました: ${(e as Error).message}`, 'error');
    } finally {
      setUploadLoading(false);
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
        <Typography variant="h5" fontWeight="bold">UpdateService</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}>更新</Button>
        <Button size="small" variant="contained" startIcon={<SystemUpdateAltIcon />}
          onClick={() => setUpdateOpen(true)}>
          SimpleUpdate
        </Button>
        <Button size="small" variant="outlined" startIcon={<CloudUploadIcon />}
          disabled={uploadLoading}
          onClick={() => fileInputRef.current?.click()}>
          {uploadLoading ? 'アップロード中...' : 'HTTP Push'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = '';
          }}
        />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label={`Firmware Inventory (${firmware.length})`} />
        <Tab label={`Software Inventory (${software.length})`} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>バージョン</TableCell>
                <TableCell>タイプ</TableCell>
                <TableCell>Updateable</TableCell>
                <TableCell>説明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {firmware.map((f) => (
                <TableRow key={f.Id as string} hover>
                  <TableCell>{f.Id as string}</TableCell>
                  <TableCell>{f.Name as string}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{f.Version as string}</TableCell>
                  <TableCell>{f.SoftwareId as string}</TableCell>
                  <TableCell>{(f.Updateable as boolean) ? '○' : '×'}</TableCell>
                  <TableCell>{f.Description as string}</TableCell>
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
                <TableCell>バージョン</TableCell>
                <TableCell>タイプ</TableCell>
                <TableCell>Updateable</TableCell>
                <TableCell>説明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {software.map((s) => (
                <TableRow key={s.Id as string} hover>
                  <TableCell>{s.Id as string}</TableCell>
                  <TableCell>{s.Name as string}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{s.Version as string}</TableCell>
                  <TableCell>{s.SoftwareId as string}</TableCell>
                  <TableCell>{(s.Updateable as boolean) ? '○' : '×'}</TableCell>
                  <TableCell>{s.Description as string}</TableCell>
                </TableRow>
              ))}
              {software.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">ソフトウェアインベントリなし</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* SimpleUpdate Dialog */}
      <Dialog open={updateOpen} onClose={() => setUpdateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>SimpleUpdate</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Image URI" size="small" fullWidth required
              placeholder="http://example.com/firmware.bin"
              value={updateForm.ImageURI}
              onChange={(e) => setUpdateForm((p) => ({ ...p, ImageURI: e.target.value }))} />
            <TextField label="Targets (カンマ区切り、省略可)" size="small" fullWidth
              placeholder="/redfish/v1/UpdateService/FirmwareInventory/BIOS/"
              value={updateForm.Targets}
              onChange={(e) => setUpdateForm((p) => ({ ...p, Targets: e.target.value }))}
              helperText="複数のターゲットはカンマで区切ってください" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSimpleUpdate} disabled={!updateForm.ImageURI}>
            実行
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
