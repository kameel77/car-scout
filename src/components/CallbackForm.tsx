import { useState } from 'react';
import { Car, ShieldCheck } from 'lucide-react';
import { leadsApi } from '@/services/api';

interface CallbackFormProps {
    title?: string;
    titleHighlight?: string;
    description?: string;
    className?: string;
}

export function CallbackForm({
    title = 'Masz dodatkowe pytania?',
    titleHighlight = 'Oddzwonimy do Ciebie',
    description = 'Zostaw numer – doradca oddzwoni i w kilka minut przedstawi oferty z kredytu, leasingu lub wynajmu.',
    className = '',
}: CallbackFormProps) {
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim()) return;
        setStatus('loading');
        try {
            await leadsApi.submitQuickLead({ phone: phone.trim() });
            setStatus('success');
            setPhone('');
        } catch {
            setStatus('error');
        }
    };

    return (
        <section className={`rounded-2xl bg-[#1a1a1a] px-6 py-10 md:px-12 md:py-14 text-center ${className}`}>
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2a2a2a] mb-6 mx-auto">
                <Car className="w-7 h-7 text-accent" />
            </div>

            {/* Heading */}
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-3">
                {title}{' '}
                <span className="text-accent">{titleHighlight}</span>
            </h2>
            <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto mb-8">
                {description}
            </p>

            {status === 'success' ? (
                <div className="flex items-center justify-center gap-2 text-green-400 font-semibold text-lg">
                    <ShieldCheck className="w-5 h-5" />
                    Dziękujemy! Zadzwonimy do Ciebie w ciągu 24h.
                </div>
            ) : (
                <>
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Wpisz swój numer telefonu"
                            required
                            className="flex-1 h-12 px-5 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="h-12 px-6 rounded-xl bg-accent text-accent-foreground font-semibold text-sm whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-60"
                        >
                            {status === 'loading' ? 'Wysyłam...' : 'Zadzwoń do mnie'}
                        </button>
                    </form>
                    {status === 'error' && (
                        <p className="text-red-400 text-sm mt-3">Coś poszło nie tak. Spróbuj ponownie.</p>
                    )}
                    <p className="text-gray-500 text-xs mt-4 flex items-center justify-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Twoje dane są bezpieczne
                    </p>
                </>
            )}
        </section>
    );
}
