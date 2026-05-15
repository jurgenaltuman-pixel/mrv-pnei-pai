import React, { createContext, useContext, useState } from 'react';

interface DataRefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const DataRefreshContext = createContext<DataRefreshContextType | undefined>(undefined);

export function DataRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <DataRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </DataRefreshContext.Provider>
  );
}

export function useDataRefresh() {
  const context = useContext(DataRefreshContext);
  if (!context) {
    throw new Error('useDataRefresh must be used within DataRefreshProvider');
  }
  return context;
}
