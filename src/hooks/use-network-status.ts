import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isChecking: boolean;
}

async function fetchNetworkStatus(): Promise<NetworkStatus> {
  const state = await Network.getNetworkStateAsync();
  return {
    isConnected: state.isConnected ?? true,
    isInternetReachable: state.isInternetReachable ?? null,
    isChecking: false,
  };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    isChecking: true,
  });

  useEffect(() => {
    void fetchNetworkStatus().then(setStatus);

    // Poll a cada 5s (expo-network não tem addEventListener)
    const interval = setInterval(() => {
      void fetchNetworkStatus().then(setStatus);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

export async function checkNetworkOnce(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return (state.isConnected ?? false) && state.isInternetReachable !== false;
}
