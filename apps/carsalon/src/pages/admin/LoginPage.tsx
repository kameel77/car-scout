import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { toast } from 'sonner';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { data: settings } = useAppSettings();
    const { i18n } = useTranslation();

    const siteName = React.useMemo(() => {
        if (!settings) return '';
        const langCode = i18n.language.slice(0, 2).toLowerCase();
        const candidates = [
            langCode === 'en' ? settings?.siteNameEn : null,
            langCode === 'de' ? settings?.siteNameDe : null,
            langCode === 'pl' ? settings?.siteNamePl : null,
            settings?.siteNameEn,
            settings?.siteNameDe,
            settings?.siteNamePl
        ];
        const pick = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
        return pick?.trim() || 'Car Scout';
    }, [i18n.language, settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl, settings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const success = await login(email, password);

        if (success) {
            toast.success('Logged in successfully');
            navigate('/admin/dashboard');
        } else {
            toast.error('Invalid credentials');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {siteName} Admin
                    </CardTitle>
                    <CardDescription className="text-center">
                        Sign in to access the admin panel
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@carscout.pl"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                        <div className="text-center mt-4 space-y-4">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/forgot-password')}
                                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors block w-full"
                            >
                                Zapomniałeś hasła?
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium transition-colors block w-full"
                            >
                                &larr; wróć do serwisu
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
