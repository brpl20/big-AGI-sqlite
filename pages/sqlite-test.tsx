import * as React from 'react';
import { Box, Typography } from '@mui/joy';

import { SqliteTestPanel } from '../src/components/SqliteTestPanel';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';

export default withNextJSPerPageLayout({ type: 'noop' }, () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.surface',
        py: 4,
      }}
    >
      <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography level="h1" sx={{ mb: 2 }}>
            SQLite Migration Test
          </Typography>
          <Typography level="body-lg" sx={{ color: 'text.secondary' }}>
            Teste e demonstração da migração do IndexedDB para SQLite local
          </Typography>
        </Box>

        <SqliteTestPanel />
      </Box>
    </Box>
  );
});
