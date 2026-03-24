import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { LogIn, ShieldCheck, ArrowLeft } from 'lucide-react';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // MFA state
    const [mfaStep, setMfaStep] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    const { login, verifyMfa, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await login(email, password);
        if (result.success) {
            navigate('/dashboard');
        } else if (result.mfa_required) {
            setTempToken(result.temp_token);
            setMfaStep(true);
        } else {
            setError(result.error);
        }
    };

    const handleMfaSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await verifyMfa(tempToken, mfaCode);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
    };

    const backgroundBlobs = (
        <>
            <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob dark:hidden" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-2000 dark:hidden" />
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000 dark:hidden" />
        </>
    );

    // ─── MFA Code Entry Screen ─────────────────────────────────────────────
    if (mfaStep) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 dark:bg-black transition-colors duration-300 relative overflow-hidden">
                <ThemeToggle className="absolute top-4 right-4 z-50" />
                {backgroundBlobs}

                <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                    <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                        <ShieldCheck className="w-12 h-12" />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        Two-Factor Auth
                    </h2>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
                        Enter the 6-digit code to verify your identity
                    </p>

                    <GlassPanel>
                        <form className="space-y-6" onSubmit={handleMfaSubmit}>
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">
                                    {error}
                                </div>
                            )}

                            {/* Dev mode notice */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs p-3 rounded-lg text-center">
                                <strong>Dev Mode:</strong> Enter any 6-digit number (e.g. 123456)
                            </div>

                            {/* OTP input — large centered digits */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                    Verification Code
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    autoFocus
                                    className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 px-6 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                                />
                            </div>

                            <Button type="submit" isLoading={loading} icon={ShieldCheck}>
                                Verify &amp; Sign In
                            </Button>
                        </form>

                        <button
                            onClick={() => { setMfaStep(false); setMfaCode(''); setError(''); }}
                            className="mt-5 w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to login
                        </button>
                    </GlassPanel>
                </div>
            </div>
        );
    }

    // ─── Normal Login Screen ───────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 dark:bg-black transition-colors duration-300 relative overflow-hidden">
            <ThemeToggle className="absolute top-4 right-4 z-50" />
            {backgroundBlobs}

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                    <LogIn className="w-12 h-12" />
                </div>
                <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                    Welcome back
                </h2>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
                    Sign in to your SPAI Engine
                </p>

                <GlassPanel>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        <Input
                            label="Email address"
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <Input
                            label="Password"
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Remember me
                                </label>
                            </div>
                            <div className="text-sm">
                                <a href="#" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                                    Forgot password?
                                </a>
                            </div>
                        </div>

                        <Button type="submit" isLoading={loading} icon={LogIn}>
                            Sign in
                        </Button>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-full relative z-20">
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
            </div>
        </div>
    );
}
