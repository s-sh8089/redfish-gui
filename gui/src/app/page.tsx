'use client';

import { useEffect, useState } from 'react';
import {
  Box, Card, CardActionArea, CardContent, Chip,
  CircularProgress, Grid, Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiGet } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export default function HomePage() {
  const [managers, setManagers] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const col = await apiGet('/redfish/v1/Managers/') as AnyObj;
        const details = await Promise.all(
          (col.Members ?? []).map((m: AnyObj) => apiGet(m['@odata.id']))
        );
        setManagers(details as AnyObj[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      <Typography variant="h5" fontWeight="bold" gutterBottom>BMC 一覧</Typography>
      <Grid container spacing={2}>
        {managers.map((mgr) => (
          <Grid item xs={12} sm={6} md={4} key={mgr.Id}>
            <Card>
              <CardActionArea onClick={() => router.push('/managers')}>
                <CardContent>
                  <Typography variant="h6">{mgr.Name}</Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ID: {mgr.Id}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={mgr.PowerState}
                      color={mgr.PowerState === 'On' ? 'success' : 'default'}
                      size="small"
                    />
                    <Chip
                      label={`${mgr.Status?.State} / ${mgr.Status?.Health}`}
                      color={mgr.Status?.Health === 'OK' ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="body2">FW バージョン: {mgr.FirmwareVersion}</Typography>
                    <Typography variant="body2">モデル: {mgr.Model}</Typography>
                    <Typography variant="body2">メーカー: {mgr.Manufacturer}</Typography>
                    <Typography variant="body2">シリアル: {mgr.SerialNumber}</Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </AppLayout>
  );
}
