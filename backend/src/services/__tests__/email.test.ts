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
    it('should omit replyTo if email is not provided', async () => {
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
            leadType: 'sale',
            listingId: 'listing-abc',
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
        expect(sentMailArgs.replyTo).toBeUndefined();
    });

    it('should use provided email address for replyTo if email is present', async () => {
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
    });
});
