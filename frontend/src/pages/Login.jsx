import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { LogIn, ShieldCheck, ArrowLeft, KeyRound, MailCheck, Lock } from 'lucide-react';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';

// step: 'login' | 'mfa' | 'forgot' | 'reset'
export default function Login() {
    const [step, setStep] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // MFA
    const [tempToken, setTempToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    // Forgot / Reset
    const [forgotEmail, setForgotEmail] = useState('');
    const [devToken, setDevToken] = useState('');       // shown in dev mode
    const [resetToken, setResetToken] = useState('');   // user pastes / auto-filled
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { login, verifyMfa, loading } = useAuth();
    const navigate = useNavigate();

    const goBack = (target = 'login') => {
        setError(''); setSuccessMsg('');
        setStep(target);
    };

    // ── Login ────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault(); setError('');
        const result = await login(email, password);
        if (result.success) {
            navigate('/dashboard');
        } else if (result.mfa_required) {
            setTempToken(result.temp_token);
            setStep('mfa');
        } else {
            setError(result.error);
        }
    };

    // ── MFA ──────────────────────────────────────────────────────────
    const handleMfaSubmit = async (e) => {
        e.preventDefault(); setError('');
        const result = await verifyMfa(tempToken, mfaCode);
        if (result.success) navigate('/dashboard');
        else setError(result.error);
    };

    // ── Forgot password ──────────────────────────────────────────────
    const handleForgotSubmit = async (e) => {
        e.preventDefault(); setError(''); setSubmitting(true);
        try {
            const res = await axios.post('http://localhost:8000/auth/forgot-password', { email: forgotEmail });
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

    // ── Reset password ────────────────────────────────────────────────
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
            setTimeout(() => goBack('login'), 2000);
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

    const pageShell = (children) => (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 dark:bg-black transition-colors duration-300 relative overflow-hidden">
            <ThemeToggle className="absolute top-4 right-4 z-50" />
            {backgroundBlobs}
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">{children}</div>
        </div>
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

    const backBtn = (target = 'login', label = 'Back to login') => (
        <button
            onClick={() => goBack(target)}
            className="mt-5 w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
            <ArrowLeft className="w-4 h-4" />{label}
        </button>
    );

    // ═══════════════════════════════════════════════════════ MFA STEP
    if (step === 'mfa') return pageShell(
        <>
            <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                <ShieldCheck className="w-12 h-12" />
            </div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Two-Factor Auth</h2>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">Enter the 6-digit code to verify your identity</p>
            <GlassPanel>
                <form className="space-y-5" onSubmit={handleMfaSubmit}>
                    {errorBox}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs p-3 rounded-lg text-center">
                        <strong>Dev Mode:</strong> Enter any 6-digit number (e.g. 123456)
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">Verification Code</label>
                        <input
                            type="text" inputMode="numeric" maxLength={6} value={mfaCode} autoFocus
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 px-6 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                        />
                    </div>
                    <Button type="submit" isLoading={loading} icon={ShieldCheck}>Verify &amp; Sign In</Button>
                </form>
                {backBtn()}
            </GlassPanel>
        </>
    );

    // ═══════════════════════════════════════════════════ FORGOT PASSWORD
    if (step === 'forgot') return pageShell(
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
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                        />
                        <Button type="submit" isLoading={submitting} icon={MailCheck}>
                            Send Reset Link
                        </Button>
                    </form>
                )}
                {backBtn()}
            </GlassPanel>
        </>
    );

    // ═══════════════════════════════════════════════════ RESET PASSWORD
    if (step === 'reset') return pageShell(
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
                {!successMsg && backBtn('forgot', 'Back')}
            </GlassPanel>
        </>
    );

    // ═══════════════════════════════════════════════════════ LOGIN (default)
    return pageShell(
        <>
            <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                <LogIn className="w-12 h-12" />
            </div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">Sign in to your SPAIE</p>

            <GlassPanel>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {errorBox}
                    <Input label="Email address" id="email" type="email" autoComplete="email" required
                        placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input label="Password" id="password" type="password" autoComplete="current-password" required
                        placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input id="remember-me" name="remember-me" type="checkbox"
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600" />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Remember me</label>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setForgotEmail(email); setStep('forgot'); setError(''); setSuccessMsg(''); setDevToken(''); }}
                            className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                        >
                            Forgot password?
                        </button>
                    </div>

                    <Button type="submit" isLoading={loading} icon={LogIn}>Sign in</Button>
                </form>

                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-full">
                                Or create an account
                            </span>
                        </div>
                    </div>
                    <div className="mt-6 text-center">
                        <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                            Register for an account &rarr;
                        </Link>
                    </div>
                </div>
            </GlassPanel>
        </>
    );
}
