import { EmailEncryption } from './EmailEncryption';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface GoogleAuthRequest {
  token: string;
  rememberMe?: boolean;
}

class AuthService {
  private baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/auth` : 'http://localhost:8090/api/auth';
  private tokenKey = 'auth_token';
  private refreshTokenKey = 'refresh_token';
  private userKey = 'user_data';

  // Store tokens in localStorage
  private setTokens(token: string, refreshToken: string): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Get stored refresh token
  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  // Store user data
  setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  // Get stored user data
  getUser(): User | null {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  // Clear all auth data
  clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }

  // Make authenticated request
  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry the request with new token
        const newToken = this.getToken();
        const newHeaders = {
          'Content-Type': 'application/json',
          ...(newToken && { Authorization: `Bearer ${newToken}` }),
          ...options.headers,
        };

        return fetch(url, {
          ...options,
          headers: newHeaders,
        });
      }
    }

    return response;
  }

  // Email/Password Signup
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const encryptedEmail = await EmailEncryption.encrypt(email);
      
      const response = await fetch(`${this.baseURL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: encryptedEmail,
          password,
          name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }

      const data: AuthResponse = await response.json();
      this.setTokens(data.token, data.refreshToken);
      this.setUser(data.user);
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  // Email/Password Login
  async login(email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> {
    try {
      const encryptedEmail = await EmailEncryption.encrypt(email);
      
      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: encryptedEmail,
          password,
          rememberMe,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data: AuthResponse = await response.json();
      this.setTokens(data.token, data.refreshToken);
      this.setUser(data.user);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Google OAuth Login
  async googleLogin(token: string, rememberMe: boolean = false): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          rememberMe,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Google login failed');
      }

      const data: AuthResponse = await response.json();
      this.setTokens(data.token, data.refreshToken);
      this.setUser(data.user);
      return data;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }

  // Hardcoded login (for testing with password@123)
  async hardcodedLogin(email: string, rememberMe: boolean = false): Promise<AuthResponse> {
    try {
      const encryptedEmail = await EmailEncryption.encrypt(email);
      
      const response = await fetch(`${this.baseURL}/hardcoded-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: encryptedEmail,
          rememberMe,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Hardcoded login failed');
      }

      const data: AuthResponse = await response.json();
      this.setTokens(data.token, data.refreshToken);
      this.setUser(data.user);
      return data;
    } catch (error) {
      console.error('Hardcoded login error:', error);
      throw error;
    }
  }

  // Refresh token
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.baseURL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      this.setTokens(data.token, data.refreshToken);
      return true;
    } catch (error) {
      console.error('Refresh token error:', error);
      this.clearAuth();
      return false;
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await this.makeRequest(`${this.baseURL}/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.makeRequest(`${this.baseURL}/me`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      this.setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Check if token is expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < expirationTime;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
}

export const authService = new AuthService(); 