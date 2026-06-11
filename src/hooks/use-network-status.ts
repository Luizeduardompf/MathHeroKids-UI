import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isChecking: boolean;
}

/**
 * Retorna o estado de conectividade de rede.
 * isConnected: true = interface de rede disponível.
 * isInternetReachable: true = internet confirmada (pode ser null enquanto verifica).
 * isChecking: true durante a primeira verificação.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    isChecking: true,
  });

  useEffect(() => {
    // Verificação imediata
    void NetInfo.fetch().then((state) => {
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        isChecking: false,
      });
    });

    // Subscriber para mudanças em tempo real
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        isChecking: false,
      });
    });

    return unsubscribe;
  }, []);

  return status;
}

/**
 * Versão one-shot para verificação imperativa antes de chamar uma EF.
 * Retorna true se há conectividade.
 */
export async function checkNetworkOnce(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return (state.isConnected ?? false) && state.isInternetReachable !== false;
}
