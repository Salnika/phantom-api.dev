import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

// Function to get CSRF token (using plain axios to avoid interceptor loop)
const getCSRFToken = async () => {
  try {
    const response = await axios.create().get(`${API_BASE_URL}/csrf-token`, {
      withCredentials: true
    });
    return response.data?.csrfToken;
  } catch (error) {
    console.warn('Could not fetch CSRF token:', error);
    return null;
  }
};

export const authService = {
  async login(email: string, password: string): Promise<boolean> {
    try {
      const csrfToken = await getCSRFToken();

      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        withCredentials: true
      });

      return response.status === 200 && response.data?.success === true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  async getCurrentUser() {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/api/current-user`, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  async logout() {
    try {
      const csrfToken = await getCSRFToken();
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: {
          'CSRF-Token': csrfToken
        },
        withCredentials: true
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
};