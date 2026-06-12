'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert, Box, Button, Container, Paper,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '@/context/AuthContext';
import { SERVERS, useServer } from '@/context/ServerContext';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const { login } = useAuth();
  const { current, setCurrent } = useServer();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push(redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f5f5',
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                borderRadius: '50%',
                p: 1.5,
                mb: 1.5,
                display: 'flex',
              }}
            >
              <LockOutlinedIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight="bold">Redfish GUI</Typography>
          </Box>

          <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup value={current.port} exclusive size="small">
              {SERVERS.map((s) => (
                <ToggleButton key={s.port} value={s.port} onClick={() => setCurrent(s)}>
                  {s.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, textAlign: 'center' }}>
            {current.host}:{current.port}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            label="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            autoFocus
            disabled={loading}
            sx={{ mb: 2 }}
          />
          <TextField
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            disabled={loading}
            sx={{ mb: 3 }}
          />
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleLogin}
            disabled={!username || !password || loading}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
