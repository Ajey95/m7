import '@testing-library/jest-dom';

// Mock next/navigation hooks
jest.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }),
  };
});

// Basic mocks for custom contexts used in components
jest.mock('./src/lib/toast-context', () => ({
  useToast: () => ({
    addToast: jest.fn(),
  }),
}));

jest.mock('./src/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
  }),
}));

