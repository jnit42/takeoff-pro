import React, { useState, useCallback, createContext, useContext } from 'react';

interface ClientModeContextType {
  isClientMode: boolean;
  toggleClientMode: () => void;
  setClientMode: (value: boolean) => void;
}

const ClientModeContext = createContext<ClientModeContextType | undefined>(undefined);

interface ClientModeProviderProps {
  children: React.ReactNode;
}

export function ClientModeProvider(props: ClientModeProviderProps) {
  const [isClientMode, setIsClientModeState] = useState(false);

  const toggleClientMode = useCallback(() => {
    setIsClientModeState((prev) => !prev);
  }, []);

  const setClientMode = useCallback((value: boolean) => {
    setIsClientModeState(value);
  }, []);

  const contextValue: ClientModeContextType = { 
    isClientMode, 
    toggleClientMode, 
    setClientMode 
  };

  return React.createElement(
    ClientModeContext.Provider,
    { value: contextValue },
    props.children
  );
}

export function useClientMode(): ClientModeContextType {
  const context = useContext(ClientModeContext);
  if (context === undefined) {
    throw new Error('useClientMode must be used within a ClientModeProvider');
  }
  return context;
}
