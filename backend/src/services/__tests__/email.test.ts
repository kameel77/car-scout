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
});
