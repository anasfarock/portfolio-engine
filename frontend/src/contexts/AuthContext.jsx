import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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

    // You can set the default base URL for Axios here
    // axios.defaults.baseURL = 'http://localhost:8000';

    const fetchUser = async () => {
        try {
            const response = await axios.get('http://localhost:8000/users/me');
            setUser(response.data);
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            // If token is invalid, log out
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

            // MFA required — return temp token to Login.jsx for the code step
            if (data.mfa_required) {
                return { success: false, mfa_required: true, temp_token: data.temp_token };
            }

            localStorage.setItem('access_token', data.access_token);
            setToken(data.access_token);
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
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Invalid code' };
        } finally {
            setLoading(false);
        }
    };

    const register = async (email, password, full_name) => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/register', {
                email,
                password,
                full_name
            });
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
    };

    return (
        <AuthContext.Provider value={{ user, token, login, verifyMfa, register, verifyRegistration, logout, loading, isCheckingAuth, refetchUser: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};
