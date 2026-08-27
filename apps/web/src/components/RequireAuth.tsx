import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { LoadingState } from '@dynamox/ui';

import { useAppSelector } from '../store';

/**
 * Proteção reutilizável das rotas privadas. O backend continua sendo a autoridade
 * (toda rota da API exige JWT); aqui só se evita renderizar telas privadas sem sessão.
 */
export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <LoadingState label="Restaurando sessão…" />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
