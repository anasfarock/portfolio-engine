import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';
import { KeyRound, Lock, MailCheck, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';

export default function ForgotPassword() {
    const [step, setStep] = useState('forgot'); // 'forgot' | 'reset'
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reset token fields
    const [devToken, setDevToken] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const navigate = useNavigate();

    const handleForgotSubmit = async (e) => {
        e.preventDefault(); setError(''); setSubmitting(true);
        try {
            const res = await axios.post('http://localhost:8000/auth/forgot-password', { email });
            if (res.data.dev_token) {
                setDevToken(res.data.dev_token);
                setResetToken(res.data.dev_token); // auto-fill
            }
            setSuccessMsg(res.data.message);
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault(); setError(''); setSubmitting(true);
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match'); setSubmitting(false); return;
        }
        try {
            const res = await axios.post('http://localhost:8000/auth/reset-password', {
                token: resetToken,
                new_password: newPassword
            });
            setSuccessMsg(res.data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Reset failed');
        } finally {
            setSubmitting(false);
        }
    };

    const backgroundBlobs = (
        <>
            <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob dark:hidden" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-2000 dark:hidden" />
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000 dark:hidden" />
        </>
    );

    const errorBox = error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">
            {error}
        </div>
    );

    const successBox = successMsg && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm p-3 rounded-lg text-center">
            {successMsg}
        </div>
    );

    const backBtn = (action, label = 'Back to login') => (
        <button
            type="button"
            onClick={action}
            className="mt-5 w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
            <ArrowLeft className="w-4 h-4" />{label}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 dark:bg-black transition-colors duration-300 relative overflow-hidden">
            <ThemeToggle className="absolute top-4 right-4 z-50" />
            {backgroundBlobs}
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                
                {step === 'forgot' ? (
                    <>
                        <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                            <KeyRound className="w-12 h-12" />
                        </div>
                        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Forgot Password</h2>
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
                            Enter your email and we'll generate a reset token
                        </p>
                        <GlassPanel>
                            {successMsg ? (
                                <div className="space-y-4">
                                    {successBox}
                                    {devToken && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                                            <p className="font-semibold">Dev Mode — Reset Token:</p>
                                            <p className="font-mono break-all">{devToken}</p>
                                            <p className="opacity-70">This is auto-filled in the next step. In production this would be emailed.</p>
                                        </div>
                                    )}
                                    <Button onClick={() => { setStep('reset'); setError(''); setSuccessMsg(''); }} icon={Lock}>
                                        Continue to Reset Password
                                    </Button>
                                </div>
                            ) : (
                                <form className="space-y-5" onSubmit={handleForgotSubmit}>
                                    {errorBox}
                                    <Input
                                        label="Email address"
                                        id="forgot-email"
                                        type="email"
                                        required
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                    <Button type="submit" isLoading={submitting} icon={MailCheck}>
                                        Send Reset Link
                                    </Button>
                                </form>
                            )}
                            {backBtn(() => navigate('/login'))}
                        </GlassPanel>
                    </>
                ) : (
                    <>
                        <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                            <Lock className="w-12 h-12" />
                        </div>
                        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Reset Password</h2>
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
                            Paste your reset token and choose a new password
                        </p>
                        <GlassPanel>
                            {successMsg ? (
                                <div className="space-y-4">
                                    {successBox}
                                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">Redirecting to login…</p>
                                </div>
                            ) : (
                                <form className="space-y-5" onSubmit={handleResetSubmit}>
                                    {errorBox}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reset Token</label>
                                        <textarea
                                            rows={2}
                                            value={resetToken}
                                            onChange={(e) => setResetToken(e.target.value)}
                                            placeholder="Paste your reset token here"
                                            className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#141414] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-colors"
                                        />
                                    </div>
                                    <Input
                                        label="New Password"
                                        id="new-password"
                                        type="password"
                                        required
                                        placeholder="Min 6 characters"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                    <Input
                                        label="Confirm New Password"
                                        id="confirm-password"
                                        type="password"
                                        required
                                        placeholder="Repeat new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    <Button type="submit" isLoading={submitting} icon={Lock}>
                                        Reset Password
                                    </Button>
                                </form>
                            )}
                            {!successMsg && backBtn(() => { setStep('forgot'); setError(''); setSuccessMsg(''); }, 'Back')}
                        </GlassPanel>
                    </>
                )}
            </div>
        </div>
    );
}
