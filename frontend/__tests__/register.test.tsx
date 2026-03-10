import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '../src/app/register/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock toast context
jest.mock('../src/lib/toast-context', () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

// Mock apiService methods used in the register page
jest.mock('../src/lib/api-service', () => ({
  apiService: {
    register: jest.fn().mockResolvedValue({ data: {}, error: null }),
    login: jest.fn().mockResolvedValue({ data: { token: 'fake-token' }, error: null }),
    uploadLicenseFile: jest.fn(),
    submitNgoLicense: jest.fn(),
  },
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn().mockImplementation((success) =>
    success({ coords: { latitude: 40.7128, longitude: -74.006 } })
  ),
};
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

describe('RegisterPage', () => {
  it('renders the registration page with step 1 heading', () => {
    render(<RegisterPage />);

    expect(screen.getByText(/Partner Registration/i)).toBeInTheDocument();
  });

  it('renders basic form fields on step 1', () => {
    render(<RegisterPage />);

    // The form uses <label> without htmlFor, so use placeholder text to find inputs
    expect(screen.getByPlaceholderText(/NGO Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/contact@org.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\+91/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText(/NGO Name/i), {
      target: { value: 'Test NGO' },
    });
    fireEvent.change(screen.getByPlaceholderText(/contact@org.com/i), {
      target: { value: 'ngo@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/\+91/i), {
      target: { value: '+910000000000' },
    });

    // Get password fields by placeholder (both have "••••••••")
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordFields[0], {
      target: { value: 'Password123!' },
    });
    fireEvent.change(passwordFields[1], {
      target: { value: 'Mismatch123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Passwords do not match/i),
      ).toBeInTheDocument();
    });
  });
});
