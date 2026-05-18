import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SessionExpiredModal from '../components/ui/SessionExpiredModal';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => {
        const stored = localStorage.getItem('access_token');
        return (stored === 'null' || stored === 'undefined') ? null : stored;
    });
    const [loading, setLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [sessionExpired, setSessionExpired] = useState(false);

    // Use a ref to avoid the interceptor triggering on auth routes (login, register, etc.)
    const isAuthRoute = useRef(false);

    // ─── Global 401 interceptor ────────────────────────────────────────────────
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                const status = error.response?.status;
                const url = error.config?.url || '';

                // Ignore 401s from auth endpoints (wrong password etc. are expected there)
                const isPublicAuthCall =
                    url.includes('/login') ||
                    url.includes('/register') ||
                    url.includes('/auth/google') ||
                    url.includes('/mfa/verify') ||
                    url.includes('/forgot-password') ||
                    url.includes('/reset-password') ||
                    url.includes('/users/me'); // handled separately in fetchUser

                if (status === 401 && !isPublicAuthCall) {
                    // Clear session and show expired modal
                    localStorage.removeItem('access_token');
                    delete axios.defaults.headers.common['Authorization'];
                    setToken(null);
                    setUser(null);
                    setSessionExpired(true);
                }

                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const fetchUser = async () => {
        try {
            const response = await axios.get('http://localhost:8000/users/me');
            setUser(response.data);
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            if (error.response?.status === 401) {
                logout();
            }
        } finally {
            setIsCheckingAuth(false);
        }
    };

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUser();
        } else {
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setIsCheckingAuth(false);
        }
    }, [token]);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/login', { email, password });
            const data = response.data;

            if (data.mfa_required) {
                return { success: false, mfa_required: true, temp_token: data.temp_token };
            }

            localStorage.setItem('access_token', data.access_token);
            setToken(data.access_token);
            setSessionExpired(false);
            return { success: true };
        } catch (error) {
            let errorMsg = error.response?.data?.detail || 'Login failed';
            if (Array.isArray(errorMsg)) {
                errorMsg = errorMsg.map(err => {
                    if (err.loc?.includes('email')) return "Please enter a valid email address.";
                    return err.msg;
                }).join(' ');
            }
            return { success: false, error: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    const verifyMfa = async (temp_token, code) => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/mfa/verify', { temp_token, code });
            const { access_token } = response.data;
            localStorage.setItem('access_token', access_token);
            setToken(access_token);
            setSessionExpired(false);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Invalid code' };
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = async (credential) => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/auth/google', { credential });
            const data = response.data;
            if (data.mfa_required) {
                return { success: false, mfa_required: true, temp_token: data.temp_token };
            }
            localStorage.setItem('access_token', data.access_token);
            setToken(data.access_token);
            setSessionExpired(false);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Google Login failed' };
        } finally {
            setLoading(false);
        }
    };

    const register = async (email, password, full_name) => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/register', { email, password, full_name });
            return { success: true, require_verification: true, email: email };
        } catch (error) {
            let errorMsg = error.response?.data?.detail || 'Registration failed';
            if (Array.isArray(errorMsg)) {
                errorMsg = errorMsg.map(err => {
                    if (err.loc?.includes('email')) return "Please enter a valid email address.";
                    return err.msg;
                }).join(' ');
            }
            return { success: false, error: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    const verifyRegistration = async (email, code) => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/register/verify', { email, code });
            const { access_token } = response.data;
            localStorage.setItem('access_token', access_token);
            setToken(access_token);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Verification failed' };
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        setToken(null);
        setSessionExpired(false);
    };

    // Handler for the "Sign In Again" button on the modal
    const handleSessionExpiredLogin = () => {
        setSessionExpired(false);
        // Redirect to login — use window.location so it works outside Router context
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{
            user, token, login, loginWithGoogle, verifyMfa,
            register, verifyRegistration, logout, loading,
            isCheckingAuth, refetchUser: fetchUser
        }}>
            {children}

            {/* Session expired overlay — renders on top of any page */}
            {sessionExpired && (
                <SessionExpiredModal onLogin={handleSessionExpiredLogin} />
            )}
        </AuthContext.Provider>
    );
};
