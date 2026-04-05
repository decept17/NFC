import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Helper to determine the correct base URL
const getBaseUrl = () => {
  // If EXPO_PUBLIC_API_URL is set in .env, use it
  if (process.env.EXPO_PUBLIC_API_URL) {
      // Small helper for Android emulator if EXPO_PUBLIC_API_URL was kept as localhost
      if (Platform.OS === 'android' && process.env.EXPO_PUBLIC_API_URL.includes('localhost')) {
          return process.env.EXPO_PUBLIC_API_URL.replace('localhost', '10.0.2.2');
      }
      return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Default fallbacks
  if (__DEV__) {
      // For local development when .env is not present
      const localhost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
      return `http://${localhost}:8000/api`;
  }
  
  // Production fallback
  return 'https://your-production-url.com/api'; 
};

export const API_BASE_URL = getBaseUrl();

/**
 * Enhanced fetch utility that automatically attaches the JWT token
 * and constructs the full URL.
 */
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attempt to load token
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Failed to retrieve token from SecureStore", error);
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);
  
  // You can add global response handling here (e.g., catching 401s for logout)
  // if (response.status === 401) {
  //     // Dispatch a global logout event or use a ref to an auth context
  // }
  
  return response;
};

// ---------------------------------------------------------------------------
// Named API functions — used by screens AND mocked in tests
// ---------------------------------------------------------------------------

/** Authenticate a user (parent or child) and return token + role. */
export const loginUser = async (identifier: string, password: string) => {
  const body = new URLSearchParams({ username: identifier, password });
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error((await response.json()).detail ?? 'Login failed');
  return response.json();
};

/** Fetch the current balance for an account. */
export const getAccountBalance = async (accountId: string) => {
  const response = await fetchApi(`/accounts/${accountId}/balance`);
  if (!response.ok) throw new Error('Failed to fetch balance');
  return response.json() as Promise<{ balance: number }>;
};

/** Create a Stripe Checkout Session and return the hosted URL. */
export const createCheckoutSession = async ({
  amount,
  accountId,
  successUrl,
  cancelUrl,
}: {
  amount: number;
  accountId: string;
  successUrl?: string;
  cancelUrl?: string;
}) => {
  const response = await fetchApi(`/accounts/${accountId}/create-checkout-session`, {
    method: 'POST',
    body: JSON.stringify({ amount, success_url: successUrl, cancel_url: cancelUrl }),
  });
  if (!response.ok) throw new Error('Failed to create checkout session');
  return response.json() as Promise<{ url: string }>;
};

/** Simulate or trigger an NFC payment (used by dev inject button and real NFC handler). */
export const processNFCPayment = async (payload: {
  uid: string;
  counter: string;
  cmac: string;
  amount: number;
  merchantId: string;
  category: string;
}) => {
  const response = await fetchApi('/transactions/pay', {
    method: 'POST',
    body: JSON.stringify({
      uid: payload.uid,
      counter: payload.counter,
      cmac: payload.cmac,
      amount: payload.amount,
      merchantId: payload.merchantId,
      category: payload.category,
    }),
  });
  if (!response.ok) throw new Error((await response.json()).detail ?? 'Payment failed');
  return response.json() as Promise<{ status: string; balance: number }>;
};

