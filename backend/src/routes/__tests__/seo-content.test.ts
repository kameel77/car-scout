import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('SEO content (CMS) routes', () => {
    let app: FastifyInstance;
    let adminToken: string;
    let managerToken: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({
            userId: 'admin-test',
            email: 'a@test.com',
            role: 'admin',
            memberships: [
                { id: 'm1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'SUPERADMIN_PLATFORM', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });
        managerToken = app.jwt.sign({
            userId: 'manager-test',
            email: 'm@test.com',
            role: 'manager',
            memberships: [
                { id: 'm2', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'PLATFORM_MANAGER', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });
    });

    afterAll(async () => {
        await app.prisma.seoContentPage.deleteMany({ where: { urlPath: { startsWith: '/samochody/test-seo-content' } } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.seoContentPage.deleteMany({ where: { urlPath: { startsWith: '/samochody/test-seo-content' } } });
    });

    describe('GET /api/seo-content (public)', () => {
        it('returns html/metaTitle/metaDescription for a published page', async () => {
            await app.prisma.seoContentPage.create({
                data: {
                    urlPath: '/samochody/test-seo-content-pub',
                    contentMd: '## Nagłówek\n\nTreść.',
                    metaTitle: 'Tytuł CMS',
                    metaDescription: 'Opis CMS',
                    isPublished: true,
                },
            });
            const res = await app.inject({ method: 'GET', url: '/api/seo-content?path=/samochody/test-seo-content-pub' });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.html).toContain('<h2>Nagłówek</h2>');
            expect(body.metaTitle).toBe('Tytuł CMS');
            expect(body.metaDescription).toBe('Opis CMS');
        });

        it('returns 404 for an unpublished page', async () => {
            await app.prisma.seoContentPage.create({
                data: {
                    urlPath: '/samochody/test-seo-content-draft',
                    contentMd: 'Szkic.',
                    isPublished: false,
                },
            });
            const res = await app.inject({ method: 'GET', url: '/api/seo-content?path=/samochody/test-seo-content-draft' });
            expect(res.statusCode).toBe(404);
        });

        it('returns 404 for a path with no CMS entry at all', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/seo-content?path=/samochody/nie-ma-takiej-tresci' });
            expect(res.statusCode).toBe(404);
        });

        it('returns 400 when path query param is missing', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/seo-content' });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('Admin CRUD /api/admin/seo-content', () => {
        it('rejects unauthenticated requests', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/admin/seo-content' });
            expect(res.statusCode).toBe(401);
        });

        it('creates, lists, updates and deletes a page for admin/manager', async () => {
            const create = await app.inject({
                method: 'POST',
                url: '/api/admin/seo-content',
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { urlPath: '/samochody/test-seo-content-crud', contentMd: '## Q?\nA.', isPublished: false },
            });
            expect(create.statusCode).toBe(200);
            const created = create.json().page;
            expect(created.urlPath).toBe('/samochody/test-seo-content-crud');
            expect(created.isPublished).toBe(false);

            const list = await app.inject({
                method: 'GET',
                url: '/api/admin/seo-content',
                headers: { authorization: `Bearer ${managerToken}` },
            });
            expect(list.statusCode).toBe(200);
            expect(list.json().pages.some((p: any) => p.id === created.id)).toBe(true);

            const update = await app.inject({
                method: 'PUT',
                url: `/api/admin/seo-content/${created.id}`,
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { isPublished: true, metaTitle: 'Nowy tytuł' },
            });
            expect(update.statusCode).toBe(200);
            expect(update.json().page.isPublished).toBe(true);
            expect(update.json().page.metaTitle).toBe('Nowy tytuł');

            const del = await app.inject({
                method: 'DELETE',
                url: `/api/admin/seo-content/${created.id}`,
                headers: { authorization: `Bearer ${adminToken}` },
            });
            expect(del.statusCode).toBe(200);

            const getAfterDelete = await app.inject({
                method: 'GET',
                url: '/api/seo-content?path=/samochody/test-seo-content-crud',
            });
            expect(getAfterDelete.statusCode).toBe(404);
        });

        it('rejects urlPath that does not match /samochody/<slug>[/<slug>]', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/admin/seo-content',
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { urlPath: '/leasing/test-seo-content', contentMd: 'Treść.' },
            });
            expect(res.statusCode).toBe(400);
        });

        it('normalizes urlPath diacritics server-side on create (Škoda -> skoda)', async () => {
            const create = await app.inject({
                method: 'POST',
                url: '/api/admin/seo-content',
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { urlPath: '/samochody/Škoda', contentMd: '## Q?\nA.' },
            });
            expect(create.statusCode).toBe(200);
            const created = create.json().page;
            expect(created.urlPath).toBe('/samochody/skoda');
            await app.prisma.seoContentPage.delete({ where: { id: created.id } });
        });

        it('rejects duplicate urlPath with 409', async () => {
            await app.prisma.seoContentPage.create({
                data: { urlPath: '/samochody/test-seo-content-dup', contentMd: 'Treść.' },
            });
            const res = await app.inject({
                method: 'POST',
                url: '/api/admin/seo-content',
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { urlPath: '/samochody/test-seo-content-dup', contentMd: 'Inna treść.' },
            });
            expect(res.statusCode).toBe(409);
        });
    });
});
