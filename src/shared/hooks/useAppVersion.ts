import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

export function useAppVersion() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    async function fetchVersion() {
      try {
        const v = await getVersion();
        setVersion(v);
      } catch (err) {
        console.error('Failed to get app version:', err);
        setVersion('0.0.0');
      }
    }
    fetchVersion();
  }, []);

  return version;
}
