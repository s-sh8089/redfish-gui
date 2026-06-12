'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import RefreshIcon from '@mui/icons-material/Refresh';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost } from '@/lib/api';

type AnyObj = Record<string, unknown>;

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ width: 220, color: 'text.secondary', flexShrink: 0, fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
}

export default function CertificatesPage() {
  const [tab, setTab] = useState(0);
  const [certLocations, setCertLocations] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const [csrOpen, setCsrOpen] = useState(false);
  const [csrForm, setCsrForm] = useState({
    CommonName: 'bmc.example.com',
    Organization: 'Example Corp',
    CertificateCollection: '/redfish/v1/Managers/bmc/NetworkProtocol/HTTPS/Certificates/',
  });
  const [csrResult, setCsrResult] = useState('');

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceForm, setReplaceForm] = useState({
    CertificateString: '',
    CertificateType: 'PEM',
    CertificateUri: '/redfish/v1/Managers/bmc/NetworkProtocol/HTTPS/Certificates/1/',
  });

  const notify = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchCertLocations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/redfish/v1/CertificateService/CertificateLocations/') as AnyObj;
      setCertLocations(((data['Links'] as AnyObj)?.Certificates ?? []) as AnyObj[]);
    } catch {
      notify('証明書ロケーションの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCertLocations(); }, [fetchCertLocations]);

  const handleGenerateCSR = async () => {
    try {
      const result = await apiPost('/redfish/v1/CertificateService/Actions/CertificateService.GenerateCSR', {
        CommonName: csrForm.CommonName,
        Organization: [csrForm.Organization],
        CertificateCollection: { '@odata.id': csrForm.CertificateCollection },
      }) as AnyObj;
      setCsrResult((result.CSRString as string) ?? JSON.stringify(result, null, 2));
      notify('CSR を生成しました');
    } catch {
      notify('CSR の生成に失敗しました', 'error');
    }
  };

  const handleReplaceCertificate = async () => {
    try {
      await apiPost('/redfish/v1/CertificateService/Actions/CertificateService.ReplaceCertificate', {
        CertificateString: replaceForm.CertificateString,
        CertificateType: replaceForm.CertificateType,
        CertificateUri: { '@odata.id': replaceForm.CertificateUri },
      });
      notify('証明書を置き換えました');
      setReplaceOpen(false);
      setReplaceForm((p) => ({ ...p, CertificateString: '' }));
      fetchCertLocations();
    } catch {
      notify('証明書の置き換えに失敗しました', 'error');
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
        <Typography variant="h5" fontWeight="bold">CertificateService</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchCertLocations}>更新</Button>
        <Button size="small" variant="outlined" startIcon={<AssignmentIcon />} onClick={() => { setCsrResult(''); setCsrOpen(true); }}>
          CSR 生成
        </Button>
        <Button size="small" variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => setReplaceOpen(true)}>
          証明書置き換え
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label={`証明書ロケーション (${certLocations.length})`} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>証明書 URI</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {certLocations.map((c, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{c['@odata.id'] as string}</TableCell>
                </TableRow>
              ))}
              {certLocations.length === 0 && (
                <TableRow>
                  <TableCell align="center">証明書なし</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* CSR Dialog */}
      <Dialog open={csrOpen} onClose={() => setCsrOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>CSR 生成</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="CommonName" size="small" fullWidth
              value={csrForm.CommonName}
              onChange={(e) => setCsrForm((p) => ({ ...p, CommonName: e.target.value }))} />
            <TextField label="Organization" size="small" fullWidth
              value={csrForm.Organization}
              onChange={(e) => setCsrForm((p) => ({ ...p, Organization: e.target.value }))} />
            <TextField label="CertificateCollection (@odata.id)" size="small" fullWidth
              value={csrForm.CertificateCollection}
              onChange={(e) => setCsrForm((p) => ({ ...p, CertificateCollection: e.target.value }))} />
            {csrResult && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>生成された CSR:</Typography>
                <TextField
                  multiline rows={8} fullWidth size="small"
                  value={csrResult}
                  InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsrOpen(false)}>閉じる</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleGenerateCSR}>
            生成
          </Button>
        </DialogActions>
      </Dialog>

      {/* Replace Certificate Dialog */}
      <Dialog open={replaceOpen} onClose={() => setReplaceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>証明書置き換え</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="証明書 URI (@odata.id)" size="small" fullWidth
              value={replaceForm.CertificateUri}
              onChange={(e) => setReplaceForm((p) => ({ ...p, CertificateUri: e.target.value }))} />
            <TextField
              label="CertificateString (PEM)" size="small" fullWidth multiline rows={8}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              value={replaceForm.CertificateString}
              onChange={(e) => setReplaceForm((p) => ({ ...p, CertificateString: e.target.value }))}
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
            <InfoRow label="CertificateType" value={replaceForm.CertificateType} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplaceOpen(false)}>キャンセル</Button>
          <Button variant="contained" startIcon={<SwapHorizIcon />} onClick={handleReplaceCertificate}
            disabled={!replaceForm.CertificateString.trim()}>
            置き換え
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
