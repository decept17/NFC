import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetchApi } from '../services/api';

type UserContext = {
    id: string;
    role: string; // 'parent' or 'child'
};

type AuthContextType = {
    user: UserContext | null;
    isLoading: boolean;
    login: (token: string, userDetails: UserContext) => Promise<void>;
    register: (token: string, userDetails: UserContext) => Promise<void>;
    socialLogin: (provider: string, token: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<UserContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing token on app load
        const bootstrapAsync = async () => {
            try {
                const token = await SecureStore.getItemAsync('userToken');
                // If we also saved user details:
                const userData = await SecureStore.getItemAsync('userData');
                if (token && userData) {
                    setUser(JSON.parse(userData));
                }
            } catch (e) {
                console.warn("Restoring token failed", e);
            } finally {
                setIsLoading(false);
            }
        };

        bootstrapAsync();
    }, []);

    const login = async (token: string, userDetails: UserContext) => {
        setIsLoading(true);
        try {
            await SecureStore.setItemAsync('userToken', token);
            await SecureStore.setItemAsync('userData', JSON.stringify(userDetails));
            setUser(userDetails);
        } catch (e) {
            console.error("Login save error", e);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            await SecureStore.deleteItemAsync('userToken');
            await SecureStore.deleteItemAsync('userData');
            setUser(null);
        } catch (e) {
            console.error("Logout error", e);
        }
    };

    const register = async (token: string, userDetails: UserContext) => {
        // Registration will just use the login function for now
        // since both involve receiving a token from the backend and storing it 
        await login(token, userDetails);
    };

    const socialLogin = async (provider: string, token: string) => {
        // Placeholder for future OAuth implementations
        console.log(`Simulating social login for ${provider} with token ${token}...`);
        // For now, doing nothing that affects secure storage or user state
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, socialLogin, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
