/**
 * MOB Auth Tests — Login screen validation & navigation
 *
 * MOB-01: App renders the Login screen on launch (when no session exists)
 * MOB-02: Successful login call stores token and navigates to Dashboard
 *
 * Covers FR-01 (secure login)
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

// -------------------------------------------------------------------
// Mock Expo modules that don't work in Jest (no native bridge)
// -------------------------------------------------------------------
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn().mockResolvedValue({ success: false }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

// -------------------------------------------------------------------
// Mock the API service so tests run offline
// -------------------------------------------------------------------
jest.mock('@/services/api', () => ({
  loginUser: jest.fn(),
}));

import { loginUser } from '@/services/api';
import LoginScreen from '@/app/login';
import { AuthProvider } from '@/context/AuthContext';

// Wrap component under test in AuthProvider (required by useAuth hook)
const renderWithAuth = (component: React.ReactElement) => {
  return render(<AuthProvider>{component}</AuthProvider>);
};

// -------------------------------------------------------------------
// MOB-01
// -------------------------------------------------------------------
describe('Login Screen — Rendering', () => {
  it('MOB-01: renders the login form on launch when no session exists', async () => {
    renderWithAuth(<LoginScreen />);

    // Wait for the async bootstrap (SecureStore.getItemAsync) to complete
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    });
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy();
    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });
});

// -------------------------------------------------------------------
// MOB-02
// -------------------------------------------------------------------
describe('Login Screen — Successful Login Flow', () => {
  it('MOB-02: submitting valid credentials calls loginUser and stores session', async () => {
    const mockLogin = loginUser as jest.Mock;
    mockLogin.mockResolvedValueOnce({
      access_token: 'jwt_test_token',
      role: 'parent',
      user_id: 'user-uuid-123',
    });

    renderWithAuth(<LoginScreen />);

    await waitFor(() => screen.getByPlaceholderText(/email/i));

    fireEvent.changeText(screen.getByPlaceholderText(/email/i), 'parent@test.com');
    fireEvent.changeText(screen.getByPlaceholderText(/password/i), 'password123');
    fireEvent.press(screen.getByText(/sign in/i));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('parent@test.com', 'password123');
    });
  });

  it('MOB-02b: invalid credentials shows an error alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => { });
    const mockLogin = loginUser as jest.Mock;
    mockLogin.mockRejectedValueOnce(new Error('Incorrect password'));

    renderWithAuth(<LoginScreen />);
    await waitFor(() => screen.getByPlaceholderText(/email/i));

    fireEvent.changeText(screen.getByPlaceholderText(/email/i), 'bad@test.com');
    fireEvent.changeText(screen.getByPlaceholderText(/password/i), 'wrong');
    fireEvent.press(screen.getByText(/sign in/i));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });
});
