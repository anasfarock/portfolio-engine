import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Save, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import GlassPanel from '../components/ui/GlassPanel';

export default function ChangePassword() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        setLoading(true);
        try {
            await axios.put('http://localhost:8000/users/me', { password: newPassword }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');
            
            setTimeout(() => {
                navigate('/profile');
            }, 2000);
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update password' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full animate-fade-in">
            <div className="w-full max-w-xl mx-auto">
                <div className="mb-8 flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/profile')}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Change Password</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            Update your account security credentials
                        </p>
                    </div>
                </div>

                <GlassPanel className="p-6 sm:p-8">
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'success'
                        ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                        }`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400 dark:text-gray-500" />
                            <Input
                                label="New Password"
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 6 characters"
                                required
                                className="pl-10"
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400 dark:text-gray-500" />
                            <Input
                                label="Confirm New Password"
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                required
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button type="submit" isLoading={loading} icon={Save} className="w-full sm:w-auto px-8">
                            Update Password
                        </Button>
                    </div>
                </form>
                </GlassPanel>
            </div>
        </div>
    );
}
