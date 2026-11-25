import React, { useEffect, useState } from 'react';
import BookingPage from './pages/BookingPage';
import AdminPage from './pages/AdminPage';

const BARBER_MODE_KEY = 'ms_hair_barber_mode';

function resolveInitialMode() {
  const hash = window.location.hash;
  const path = window.location.pathname;

  if (hash === '#musteri' || path === '/musteri' || path.endsWith('/musteri')) {
    window.localStorage.setItem(BARBER_MODE_KEY, 'false');
    return 'customer';
  }

  if (hash === '#admin' || path === '/admin' || path.endsWith('/admin')) {
    window.localStorage.setItem(BARBER_MODE_KEY, 'true');
    return 'admin';
  }

  const savedMode = window.localStorage.getItem(BARBER_MODE_KEY);
  return savedMode === 'true' ? 'admin' : 'customer';
}

export default function App() {
  const [mode, setMode] = useState(() => resolveInitialMode());

  useEffect(() => {
    function handleRouteChange() {
      setMode(resolveInitialMode());
    }

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  return mode === 'admin' ? <AdminPage /> : <BookingPage />;
}