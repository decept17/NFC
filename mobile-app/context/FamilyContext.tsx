import React, { createContext, useState, useContext, ReactNode } from 'react';

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
}

// Create the Context
const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

// Create the Provider (Wraps app)
export const FamilyProvider = ({ children }: { children: ReactNode }) => {
  // MOCK DATA here!
  const [accounts, setAccounts] = useState<Account[]>([
    { id: '1', name: 'Sarah', role: 'Child', balance: 20.00, status: 'Active' },
    { id: '2', name: 'James', role: 'Child', balance: 5.50, status: 'Frozen' },
  ]);

  // Track the ID of the currently swiped child. Default to the first child.
  const [selectedAccountId, setSelectedAccountId] = useState<string>('1');

  // Helper to quickly grab the full account object of the selected child
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  return (
    <FamilyContext.Provider 
      value={{ 
        accounts, 
        setAccounts, 
        selectedAccountId, 
        setSelectedAccountId, 
        selectedAccount 
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