import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, Mail, Save, AlertCircle, CheckCircle2, Camera, Loader2, Trash2 } from 'lucide-react';

import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import GlassPanel from '../components/ui/GlassPanel';

export default function Profile() {
    const { user, refetchUser, token } = useAuth();

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword && newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        setLoading(true);
        try {
            const updateData = {};
            if (fullName !== user?.full_name) updateData.full_name = fullName;
            if (newPassword) updateData.password = newPassword;

            if (Object.keys(updateData).length === 0 && !avatarFile) {
                setMessage({ type: 'info', text: 'No changes made' });
                setLoading(false);
                return;
            }

            // 1. Handle text data updates
            if (Object.keys(updateData).length > 0) {
                await axios.put('http://localhost:8000/users/me', updateData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            // 2. Handle avatar file upload
            if (avatarFile) {
                const formData = new FormData();
                formData.append('file', avatarFile);
                await axios.post('http://localhost:8000/users/me/avatar', formData, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                setAvatarFile(null); // Clear queued file
            }

            // Re-fetch user context to update the avatar initials globally
            await refetchUser();

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');

        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update profile' });
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please upload a valid image file.' });
            return;
        }

        // Create a local preview URL
        const previewUrl = URL.createObjectURL(file);
        setAvatarPreview(previewUrl);
        setAvatarFile(file);

        // Clean up memory when component unmounts
        return () => URL.revokeObjectURL(previewUrl);
    };

    const handleRemoveAvatar = async () => {
        setMessage({ type: '', text: '' });

        // If they just selected a file but haven't saved it yet, just clear the preview
        if (avatarFile && !user?.avatar_url) {
            setAvatarFile(null);
            setAvatarPreview(null);
            return;
        }

        setLoading(true);
        try {
            await axios.delete('http://localhost:8000/users/me/avatar', {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refetchUser();
            setAvatarFile(null);
            setAvatarPreview(null);
            setMessage({ type: 'success', text: 'Avatar removed successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to remove avatar' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto w-full animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Manage your account details and security preferences
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Left Side: Avatar & Summary */}
                <div className="md:col-span-1">
                    <GlassPanel className="flex flex-col items-center text-center p-6 sm:p-6">
                        <div className="relative group mb-4">
                            <div className="w-32 h-32 rounded-full bg-primary-100 dark:bg-primary-900/30 border-4 border-white dark:border-gray-700 shadow-xl flex items-center justify-center overflow-hidden">
                                {avatarPreview ? (
                                    <img
                                        src={avatarPreview}
                                        alt="Profile Avatar"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">
                                        {user ? (user.full_name ? user.full_name.substring(0, 1).toUpperCase() : user.email.substring(0, 1).toUpperCase()) : 'U'}
                                    </span>
                                )}
                            </div>

                            {/* Hover Overlay for Upload */}
                            <label className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-4 border-transparent">
                                <Camera className="w-8 h-8 mb-1" />
                                <span className="text-xs font-semibold">
                                    {avatarPreview ? 'Change' : 'Upload'}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarChange}
                                />
                            </label>
                        </div>

                        {avatarPreview && (
                            <button
                                onClick={handleRemoveAvatar}
                                disabled={loading}
                                className="mb-4 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Remove Avatar
                            </button>
                        )}

                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            {user?.full_name || 'Portfolio User'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                            <Mail className="w-4 h-4" />
                            {user?.email}
                        </p>
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 w-full">
                            <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Active Account
                            </span>
                        </div>
                    </GlassPanel>
                </div>

                {/* Right Side: Edit Form */}
                <div className="md:col-span-2 space-y-6">
                    <GlassPanel className="p-6 sm:p-8">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                            General Information
                        </h3>

                        {message.text && (
                            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'success'
                                ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : message.type === 'info'
                                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                                }`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="relative">
                                    <User className="absolute left-3 top-9 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                    <Input
                                        label="Full Name"
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="John Doe"
                                        className="pl-10"
                                    />
                                </div>

                                <div className="relative opacity-60">
                                    <Mail className="absolute left-3 top-9 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                    <Input
                                        label="Email Address (Read-Only)"
                                        id="email"
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="pl-10 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-10 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                                Security
                            </h3>

                            <div className="space-y-4">
                                <div className="relative">
                                    <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                    <Input
                                        label="New Password"
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Leave blank to keep current"
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
                                        placeholder="Leave blank to keep current"
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button type="submit" isLoading={loading} icon={Save} className="w-full sm:w-auto px-8">
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </GlassPanel>
                </div>

            </div>
        </div>
    );
}
