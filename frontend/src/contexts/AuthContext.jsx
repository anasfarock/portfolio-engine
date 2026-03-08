import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const [loading, setLoading] = useState(false);

    // You can set the default base URL for Axios here
    // axios.defaults.baseURL = 'http://localhost:8000';

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Here you would typically fetch the user profile with the token
            // For now, we'll just simulate a logged in user
            setUser({ email: 'user@example.com' });
        } else {
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
        }
    }, [token]);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/login', {
                email,
                password
            });
            const { access_token } = response.data;
            localStorage.setItem('access_token', access_token);
            setToken(access_token);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Login failed' };
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
            // Optionally login automatically after register
            return await login(email, password);
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Registration failed' };
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
