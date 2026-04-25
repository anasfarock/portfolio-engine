import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { UserPlus } from 'lucide-react';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const { register, verifyRegistration, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        const result = await register(email, password, fullName);
        if (result.success && result.require_verification) {
            setStep(2);
        } else {
            setError(result.error || 'Registration failed');
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        const result = await verifyRegistration(email, otp);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-cover bg-center dark:bg-black transition-colors duration-300 relative">
            <ThemeToggle className="absolute top-4 right-4 z-50" />

            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob dark:hidden"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-2000 dark:hidden"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center text-primary-600 dark:text-primary-500 mb-4">
                    <UserPlus className="w-12 h-12" />
                </div>
                <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                    Create an account
                </h2>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
                    Start analyzing your portfolio today
                </p>

                <GlassPanel>
                    {step === 1 ? (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Full Name"
                                id="name"
                                type="text"
                                autoComplete="name"
                                required
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />

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
                                autoComplete="new-password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <Button type="submit" isLoading={loading} icon={UserPlus}>
                                Sign up
                            </Button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleVerify}>
                            <div className="text-center mb-6">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    We sent a 6-digit verification code to <span className="font-semibold text-gray-900 dark:text-white">{email}</span>.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Verification Code"
                                id="otp"
                                type="text"
                                required
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength={6}
                                className="text-center text-xl tracking-widest"
                            />

                            <Button type="submit" isLoading={loading}>
                                Verify & Continue
                            </Button>
                        </form>
                    )}

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-black rounded-full relative z-20">
                                    Already have an account?
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                                Log in instead &rarr;
                            </Link>
                        </div>
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}
