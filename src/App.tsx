import { useEffect, useState } from 'react';
import { getAllTasks, type Task } from "./indexedDB";


// ... dentro de export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    getAllTasks().then(setTasks).catch(console.error);
  }, []);
const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
const [canInstall, setCanInstall] = useState(false);

const [isOffline, setIsOffline] = useState(!navigator.onLine);
useEffect(() => {
  const on = () => setIsOffline(false), off = () => setIsOffline(true);
  window.addEventListener('online', on); window.addEventListener('offline', off);
  return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
}, []);

// Capturamos el evento y mostramos el botón
useEffect(() => {
  const onBIP = (e: any) => {
    // Android/desktop Chrome disparan este evento cuando la app es instalable
    e.preventDefault();             // evitamos el mini-infobar
    setDeferredPrompt(e);           // guardamos el evento para usarlo luego
    setCanInstall(true);            // mostramos el botón
  };
  window.addEventListener('beforeinstallprompt', onBIP);

  const onInstalled = () => {
    console.log('[PWA] App instalada');
    setDeferredPrompt(null);
    setCanInstall(false);
  };
  window.addEventListener('appinstalled', onInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', onBIP);
    window.removeEventListener('appinstalled', onInstalled);
  };
}, []);

const handleInstallClick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();                        // abre el diálogo nativo
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] userChoice:', outcome);      // 'accepted' | 'dismissed'
  setDeferredPrompt(null);
  setCanInstall(false);
};
