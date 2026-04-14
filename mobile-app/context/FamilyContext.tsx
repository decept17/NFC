import React, { createContext, useState, useContext, ReactNode } from 'react';

import { fetchApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

// Defining the shape of an Account
export interface Account {
  id: string;
  name: string;
  role: string;
  balance: number;
  status: string;
}

// Defining what Context will hold
type FamilyContextType = {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  selectedAccount: Account | undefined;
  refreshAccounts: () => Promise<void>;
  isLoading: boolean;
}

// Create the Context
const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

// Create the Provider (Wraps app)
export const FamilyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshAccounts = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetchApi('/accounts/my-family');
      if (response.ok) {
        const data = await response.json();
        // Map backend response to frontend Account interface
        const formattedAccounts: Account[] = data.map((acc: any) => ({
          id: acc.account_id,
          name: acc.child_name,
          role: 'Child',
          balance: acc.balance,
          status: acc.nfc_status,
        }));

        setAccounts(formattedAccounts);
        if (formattedAccounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(formattedAccounts[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch family accounts", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch accounts when user logs in
  React.useEffect(() => {
    refreshAccounts();
  }, [user]);

  // Helper to quickly grab the full account object of the selected child
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  return (
    <FamilyContext.Provider
      value={{
        accounts,
        setAccounts,
        selectedAccountId,
        setSelectedAccountId,
        selectedAccount,
        refreshAccounts,
        isLoading
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

// Create a Custom Hook so screens can easily access this data
export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};