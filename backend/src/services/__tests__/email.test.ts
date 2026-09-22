import { describe, it, expect, vi } from 'vitest';
import { sendLeadEmail } from '../email.js';
import nodemailer from 'nodemailer';

vi.mock('nodemailer', () => {
    const sendMailMock = vi.fn().mockResolvedValue({});
    return {
        default: {
            createTransport: vi.fn().mockReturnValue({
                sendMail: sendMailMock
            })
        }
    };
});

describe('sendLeadEmail', () => {
    it('should leave replyTo undefined and format empty email/name as null when email is not provided', async () => {
        const sendMailMock = (nodemailer.createTransport() as any).sendMail;
        sendMailMock.mockClear();
        
        const mockLead = {
            id: 'lead-123',
            name: 'Szybki Kontakt',
            email: null,
            phone: '609 502 342',
            preferredContact: 'phone',
            message: 'Chcę kontakt w sprawie auta',
            referenceNumber: 'AF-33018591',
            createdAt: new Date(),
            updatedAt: new Date(),
            leadType: 'quick_contact',
            listingId: null,
            trafficSource: 'google_ads',
        };

        const mockFastify = {
            prisma: {
                appSettings: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'default',
                        smtpHost: 'smtp.example.com',
                        smtpPort: 465,
                        smtpUser: 'kontakt@motolia.pl',
                        smtpPassword: 'password',
                        smtpRecipientEmail: 'lead@motolia.pl',
                        smtpFromEmail: 'kontakt@motolia.pl',
                    })
                },
                user: {
                    findUnique: vi.fn()
                },
                dealerSettings: {
                    findUnique: vi.fn()
                },
                dealer: {
                    findUnique: vi.fn()
                }
            },
            log: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            }
        };

        await sendLeadEmail(mockFastify as any, mockLead as any, 'https://motolia.pl');

        expect(sendMailMock).toHaveBeenCalled();
        const sentMailArgs = sendMailMock.mock.calls[0][0];
        // replyTo is undefined when email is not provided (avoids delivery bounce errors)
        expect(sentMailArgs.replyTo).toBeUndefined();
        // Unique subject with reference number
        expect(sentMailArgs.subject).toBe('[Motolia] [AF-33018591] Szybki kontakt: 609 502 342');
        // Name and Email formatted as 'null' when empty / placeholder
        expect(sentMailArgs.html).toContain('<strong>Imię i nazwisko:</strong> null');
        expect(sentMailArgs.html).toContain('<strong>E-mail:</strong> null');
        expect(sentMailArgs.html).toContain('<strong>Typ zgłoszenia:</strong> Zapytanie ogólne / Szybki kontakt');
        expect(sentMailArgs.html).toContain('<strong>Źródło ruchu (Source/UTM):</strong> google_ads');
    });

    it('should use provided email address for replyTo if email is present and format real name', async () => {
        const sendMailMock = (nodemailer.createTransport() as any).sendMail;
        sendMailMock.mockClear();

        const mockLead = {
            id: 'lead-123',
            name: 'Jan Kowalski',
            email: 'jan@kowalski.pl',
            phone: '609502342',
            preferredContact: 'email',
            message: 'Chcę kontakt w sprawie auta',
            referenceNumber: 'AF-33018591',
            createdAt: new Date(),
            updatedAt: new Date(),
            leadType: 'sale',
            listingId: 'listing-abc',
            listing: {
                make: 'Toyota',
                model: 'Corolla',
                version: 'Comfort',
                productionYear: 2024,
                pricePln: 110000,
                mileageKm: 15000,
                vin: 'JT123456789',
                dealerId: 'dealer-1',
                slug: 'toyota-corolla-2024'
            }
        };

        const mockFastify = {
            prisma: {
                appSettings: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'default',
                        smtpHost: 'smtp.example.com',
                        smtpPort: 465,
                        smtpUser: 'kontakt@motolia.pl',
                        smtpPassword: 'password',
                        smtpRecipientEmail: 'lead@motolia.pl',
                        smtpFromEmail: 'kontakt@motolia.pl',
                    })
                },
                user: {
                    findUnique: vi.fn()
                },
                dealerSettings: {
                    findUnique: vi.fn()
                },
                dealer: {
                    findUnique: vi.fn()
                }
            },
            log: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            }
        };

        await sendLeadEmail(mockFastify as any, mockLead as any, 'https://motolia.pl');

        expect(sendMailMock).toHaveBeenCalled();
        const sentMailArgs = sendMailMock.mock.calls[0][0];
        expect(sentMailArgs.replyTo).toBe('"Jan Kowalski" <jan@kowalski.pl>');
        expect(sentMailArgs.subject).toBe('[Motolia] [AF-33018591] Nowe zapytanie o auto: Toyota Corolla');
        expect(sentMailArgs.html).toContain('<strong>Imię i nazwisko:</strong> Jan Kowalski');
        expect(sentMailArgs.html).toContain('Toyota Corolla Comfort');
        expect(sentMailArgs.html).toContain('110\u00A0000 zł');
        expect(sentMailArgs.headers).toEqual({
            'Auto-Submitted': 'auto-generated',
            'X-Auto-Response-Suppress': 'All'
        });
    });

    it('should route B2B lead to BENEFIVO_LEAD_RECIPIENT_EMAIL, prefix subject with [Benefivo], and attach MIME headers', async () => {
        const sendMailMock = (nodemailer.createTransport() as any).sendMail;
        sendMailMock.mockClear();

        const originalEnv = process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL;
        process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL = 'b2b@benefivo.pl';

        try {
            const mockB2bLead = {
                id: 'lead-b2b-1',
                name: 'Kamil Tonkowicz',
                email: 'kamil@company.pl',
                phone: '502358645',
                preferredContact: 'email',
                message: 'Firma: Acme (NIP: 1234567890)',
                referenceNumber: 'BNF-04013827',
                createdAt: new Date(),
                updatedAt: new Date(),
                leadType: 'employer_b2b',
                trafficSource: 'benefivo_b2b',
            };

            const mockFastify = {
                prisma: {
                    appSettings: {
                        findFirst: vi.fn().mockResolvedValue({
                            id: 'default',
                            smtpHost: 'smtp.example.com',
                            smtpPort: 465,
                            smtpUser: 'kontakt@motolia.pl',
                            smtpPassword: 'password',
                            smtpRecipientEmail: 'lead@motolia.pl',
                        })
                    },
                    user: { findUnique: vi.fn() },
                    dealerSettings: { findUnique: vi.fn() },
                    dealer: { findUnique: vi.fn() }
                },
                log: {
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn()
                }
            };

            await sendLeadEmail(mockFastify as any, mockB2bLead as any, 'https://benefivo.pl');

            expect(sendMailMock).toHaveBeenCalledTimes(1);
            const sentMailArgs = sendMailMock.mock.calls[0][0];

            // 1. Recipient routed to BENEFIVO_LEAD_RECIPIENT_EMAIL
            expect(sentMailArgs.to).toBe('b2b@benefivo.pl');

            // 2. Subject prefixed with [Benefivo]
            expect(sentMailArgs.subject).toMatch(/^\[Benefivo\] \[BNF-04013827\] Zapytanie B2B - Program Pracowniczy:/);

            // 3. MIME headers attached
            expect(sentMailArgs.headers).toEqual({
                'Auto-Submitted': 'auto-generated',
                'X-Auto-Response-Suppress': 'All',
                'X-Lead-Brand': 'Benefivo',
                'X-Lead-Type': 'employer_b2b',
                'X-Lead-Traffic-Source': 'benefivo_b2b'
            });
        } finally {
            if (originalEnv !== undefined) {
                process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL = originalEnv;
            } else {
                delete process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL;
            }
        }
    });

    it('should fallback to default recipient when BENEFIVO_LEAD_RECIPIENT_EMAIL is not set for B2B lead', async () => {
        const sendMailMock = (nodemailer.createTransport() as any).sendMail;
        sendMailMock.mockClear();

        const originalEnv = process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL;
        delete process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL;

        try {
            const mockB2bLead = {
                id: 'lead-b2b-2',
                name: 'Kamil Tonkowicz',
                email: 'kamil@company.pl',
                phone: '502358645',
                preferredContact: 'email',
                message: 'Test message',
                referenceNumber: 'BNF-04013828',
                createdAt: new Date(),
                updatedAt: new Date(),
                leadType: 'employer_b2b',
                trafficSource: 'benefivo_b2b',
            };

            const mockFastify = {
                prisma: {
                    appSettings: {
                        findFirst: vi.fn().mockResolvedValue({
                            id: 'default',
                            smtpHost: 'smtp.example.com',
                            smtpPort: 465,
                            smtpUser: 'kontakt@motolia.pl',
                            smtpPassword: 'password',
                            smtpRecipientEmail: 'default-lead@motolia.pl',
                        })
                    },
                    user: { findUnique: vi.fn() },
                    dealerSettings: { findUnique: vi.fn() },
                    dealer: { findUnique: vi.fn() }
                },
                log: {
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn()
                }
            };

            await sendLeadEmail(mockFastify as any, mockB2bLead as any, 'https://benefivo.pl');

            expect(sendMailMock).toHaveBeenCalledTimes(1);
            const sentMailArgs = sendMailMock.mock.calls[0][0];

            // Falls back to AppSettings default recipient
            expect(sentMailArgs.to).toBe('default-lead@motolia.pl');
            expect(mockFastify.log.warn).not.toHaveBeenCalledWith(expect.stringContaining('BENEFIVO_LEAD_RECIPIENT_EMAIL'));
        } finally {
            if (originalEnv !== undefined) {
                process.env.BENEFIVO_LEAD_RECIPIENT_EMAIL = originalEnv;
            }
        }
    });
});
