import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
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
    biometricsAvailable: boolean;
    biometricsEnabled: boolean;
    enableBiometrics: () => Promise<void>;
    disableBiometrics: () => Promise<void>;
    authenticateWithBiometrics: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<UserContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [biometricsAvailable, setBiometricsAvailable] = useState(false);
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);

    useEffect(() => {
        const bootstrapAsync = async () => {
            try {
                // Check biometrics hardware availability
                const compatible = await LocalAuthentication.hasHardwareAsync();
                const enrolled = await LocalAuthentication.isEnrolledAsync();
                setBiometricsAvailable(compatible && enrolled);

                // Check if user has opted into biometrics
                const bioEnabled = await SecureStore.getItemAsync('biometricsEnabled');
                setBiometricsEnabled(bioEnabled === 'true');

                // Check for existing token on app load
                const token = await SecureStore.getItemAsync('userToken');
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
            // Keep biometric settings — user shouldn't have to re-enable after logout
            setUser(null);
        } catch (e) {
            console.error("Logout error", e);
        }
    };

    const register = async (token: string, userDetails: UserContext) => {
        await login(token, userDetails);
    };

    const socialLogin = async (provider: string, token: string) => {
        console.log(`Simulating social login for ${provider} with token ${token}...`);
    };

    const enableBiometrics = async () => {
        // Verify identity before enabling
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify your identity to enable biometric login',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
        });

        if (result.success) {
            await SecureStore.setItemAsync('biometricsEnabled', 'true');
            setBiometricsEnabled(true);
        }
    };

    const disableBiometrics = async () => {
        await SecureStore.deleteItemAsync('biometricsEnabled');
        setBiometricsEnabled(false);
    };

    const authenticateWithBiometrics = async (): Promise<boolean> => {
        // Check if we have a stored session to resume
        const token = await SecureStore.getItemAsync('userToken');
        const userData = await SecureStore.getItemAsync('userData');

        if (!token || !userData) {
            return false; // No stored session, can't use biometrics
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Log in to N3XO',
            cancelLabel: 'Use Password',
            disableDeviceFallback: false,
        });

        if (result.success) {
            // Restore the stored session
            setUser(JSON.parse(userData));
            return true;
        }

        return false;
    };

    return (
        <AuthContext.Provider value={{
            user, isLoading, login, register, socialLogin, logout,
            biometricsAvailable, biometricsEnabled,
            enableBiometrics, disableBiometrics, authenticateWithBiometrics,
        }}>
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
