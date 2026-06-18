# Hero Banner CMS + Hero Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CMS-managed hero banner carousel (separately-prepared graphics, like superauto.pl) to the Motolia home page, with admin control over each banner's image, CTA button label/link, and the button's vertical position on desktop.

**Architecture:** Clone the existing `FeatureTile` CMS pattern end-to-end into a new `HeroBanner` entity: Prisma model → Fastify route (CRUD + reorder + multipart image upload reusing `optimizeAndSaveImage`) → typed API client → admin page (drag-reorder + upload, clone of `FeatureTilesPage`) → public carousel component (shadcn `Carousel` over `embla-carousel-react`, with an absolutely-positioned overlaid CTA button). Phase 2 swaps the Motolia hero's static marketing column for the carousel + the existing `HeroVehicleFilter` as a floating search card (superauto layout), falling back to the current marketing hero when no banners are active.

**Tech Stack:** Fastify + Prisma (PostgreSQL) backend, React + TypeScript + Vite + TanStack Query + Tailwind frontend, `embla-carousel-react` via the shadcn `Carousel` wrapper, `@dnd-kit` for reordering, Vitest for tests.

**Brand colors (unchanged):** CTA = yellow `#F5C518` bg / black `#1A1A1A` text (hover `#D4A90A`). No green is introduced.

**Testing note:** The backend has a real Vitest harness that boots the app and hits the dev DB (`backend/src/routes/__tests__/seo.test.ts`). Phase 1 backend gets a real route test following that pattern (public endpoint + auth-rejection). The frontend has no test convention for admin pages / carousels, so frontend tasks are verified via `tsc` typecheck + `eslint` + manual browser checks rather than inventing brittle RTL tests.

---

## File Structure

**Phase 1 — Hero Banner CMS**
- Create: `backend/src/routes/hero-banners.ts` — CRUD + reorder + image upload route (clone of `feature-tiles.ts`, no vehicle-count logic, supports desktop/mobile image slots)
- Modify: `backend/prisma/schema.prisma` — add `model HeroBanner`
- Create (generated): `backend/prisma/migrations/<timestamp>_add_hero_banners/migration.sql`
- Modify: `backend/src/app.ts` — register route + add `'hero-banners'` to `PUBLIC_SLUGS`
- Create: `backend/src/routes/__tests__/hero-banners.test.ts` — route test
- Modify: `src/services/api.ts` — add `HeroBanner` / `PublicHeroBanner` types + `heroBannersApi`
- Create: `src/pages/admin/HeroBannersPage.tsx` — admin CMS (clone of `FeatureTilesPage.tsx`)
- Modify: `src/App.tsx` — lazy import + protected route `/admin/hero-banners`
- Modify: `src/components/admin/AdminSidebar.tsx` — nav entry
- Create: `src/components/HeroBannerCarousel.tsx` — public carousel

**Phase 2 — Hero integration**
- Modify: `src/pages/MotoliaHomePage.tsx` — hero section: carousel + floating search, with fallback

---

## Phase 1 — Hero Banner CMS

### Task 1: HeroBanner Prisma model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (add model next to `FeatureTile`)

- [ ] **Step 1: Add the model**

In `backend/prisma/schema.prisma`, immediately after the `model FeatureTile { ... }` block, add:

```prisma
model HeroBanner {
  id                 String   @id @default(cuid())
  imageUrlDesktop    String?  @map("image_url_desktop")
  imageUrlMobile     String?  @map("image_url_mobile")
  altText            String   @default("") @map("alt_text")
  buttonLabel        String   @default("") @map("button_label")
  buttonUrl          String   @default("") @map("button_url")
  buttonPositionYPct Int      @default(60) @map("button_position_y_pct")
  buttonAlign        String   @default("left") @map("button_align")
  isActive           Boolean  @default(true) @map("is_active")
  sortOrder          Int      @default(0) @map("sort_order")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@index([isActive, sortOrder])
  @@map("hero_banners")
}
```

- [ ] **Step 2: Sync the schema to the DB + regenerate client**

> This repo is **schema-driven, not migration-file-driven**: production applies schema changes via `npx prisma db push --accept-data-loss` on container start (`backend/Dockerfile:63`), and the `prisma/migrations` history is drifted (a DB migration `20260126183454_sync_schema_v2` is missing locally, so `migrate dev`'s shadow DB fails). Therefore we use `db push`, matching production, and do NOT create a migration file.

Run:
```bash
cd backend && npx prisma db push && npx prisma generate
```
Expected: "🚀  Your database is now in sync with your Prisma schema." and "✔ Generated Prisma Client". (Adding a brand-new table is additive, so plain `db push` needs no `--accept-data-loss`.)

- [ ] **Step 3: Verify the table exists**

Run:
```bash
cd backend && npx prisma db execute --schema prisma/schema.prisma --stdin <<< 'SELECT count(*) FROM hero_banners;'
```
Expected: exits 0 (table exists, count 0). If the table were missing, this errors.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(backend): add HeroBanner model (db push, schema-driven deploy)"
```

---

### Task 2: Hero banner backend route

**Files:**
- Create: `backend/src/routes/hero-banners.ts`
- Modify: `backend/src/app.ts` (register route ~line 315; add slug ~line 372)
- Test: `backend/src/routes/__tests__/hero-banners.test.ts`

- [ ] **Step 1: Write the route**

Create `backend/src/routes/hero-banners.ts`:

```ts
import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { authorizeRoles } from '../middleware/authorize.js';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'hero-banners');
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_BANNER_IMAGE_SIZE = 8 * 1024 * 1024;
const ALIGN_VALUES = new Set(['left', 'center', 'right']);

type BannerBody = {
  altText?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  buttonPositionYPct?: number;
  buttonAlign?: string;
  isActive?: boolean;
};

function clampPct(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}

async function unlinkBannerImage(imageUrl: string | null) {
  if (!imageUrl?.startsWith('/uploads/hero-banners/')) return;
  const oldPath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
  const thumbPath = oldPath.replace('.webp', '-thumb.webp');
  try {
    await fs.unlink(oldPath);
    await fs.unlink(thumbPath).catch(() => {});
  } catch { /* ignore */ }
}

export async function heroBannerRoutes(fastify: FastifyInstance) {
  // Public: active banners, ordered
  fastify.get('/api/hero-banners/public', async () => {
    const banners = await fastify.prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      banners: banners.map((b) => ({
        id: b.id,
        imageUrlDesktop: b.imageUrlDesktop,
        imageUrlMobile: b.imageUrlMobile,
        altText: b.altText,
        buttonLabel: b.buttonLabel,
        buttonUrl: b.buttonUrl,
        buttonPositionYPct: b.buttonPositionYPct,
        buttonAlign: b.buttonAlign,
      })),
    };
  });

  // Admin: list all
  fastify.get('/api/hero-banners', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async () => {
    const banners = await fastify.prisma.heroBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { banners };
  });

  // Admin: create
  fastify.post('/api/hero-banners', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request) => {
    const body = request.body as BannerBody;
    const max = await fastify.prisma.heroBanner.aggregate({ _max: { sortOrder: true } });
    const align = body.buttonAlign && ALIGN_VALUES.has(body.buttonAlign) ? body.buttonAlign : 'left';
    const banner = await fastify.prisma.heroBanner.create({
      data: {
        altText: body.altText ?? '',
        buttonLabel: body.buttonLabel ?? '',
        buttonUrl: body.buttonUrl ?? '',
        buttonPositionYPct: clampPct(body.buttonPositionYPct) ?? 60,
        buttonAlign: align,
        isActive: body.isActive ?? true,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    return { banner };
  });

  // Admin: update
  fastify.put('/api/hero-banners/:id', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as BannerBody;
    const pct = clampPct(body.buttonPositionYPct);
    const align = body.buttonAlign && ALIGN_VALUES.has(body.buttonAlign) ? body.buttonAlign : undefined;
    try {
      const banner = await fastify.prisma.heroBanner.update({
        where: { id },
        data: {
          ...(body.altText !== undefined ? { altText: body.altText } : {}),
          ...(body.buttonLabel !== undefined ? { buttonLabel: body.buttonLabel } : {}),
          ...(body.buttonUrl !== undefined ? { buttonUrl: body.buttonUrl } : {}),
          ...(pct !== undefined ? { buttonPositionYPct: pct } : {}),
          ...(align !== undefined ? { buttonAlign: align } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      return { banner };
    } catch {
      return reply.code(404).send({ error: 'Banner not found' });
    }
  });

  // Admin: delete (+ remove image files)
  fastify.delete('/api/hero-banners/:id', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const banner = await fastify.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) return reply.code(404).send({ error: 'Banner not found' });
    await unlinkBannerImage(banner.imageUrlDesktop);
    await unlinkBannerImage(banner.imageUrlMobile);
    await fastify.prisma.heroBanner.delete({ where: { id } });
    return { success: true };
  });

  // Admin: reorder — body: { order: [id, id, ...] }
  fastify.post('/api/hero-banners/reorder', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { order } = request.body as { order?: string[] };
    if (!Array.isArray(order)) {
      return reply.code(400).send({ error: 'order array required' });
    }
    await fastify.prisma.$transaction(
      order.map((id, idx) =>
        fastify.prisma.heroBanner.update({ where: { id }, data: { sortOrder: idx + 1 } })
      )
    );
    return { success: true };
  });

  // Admin: upload image for a banner — ?slot=desktop|mobile (default desktop)
  fastify.post('/api/hero-banners/:id/image', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { slot } = request.query as { slot?: string };
    const isMobile = slot === 'mobile';
    const banner = await fastify.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) return reply.code(404).send({ error: 'Banner not found' });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'File is required' });
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return reply.code(400).send({ error: `Unsupported MIME: ${file.mimetype}` });
    }

    await fs.mkdir(BANNERS_DIR, { recursive: true });
    const buffer = await file.toBuffer();
    if (buffer.length > MAX_BANNER_IMAGE_SIZE) {
      return reply.code(413).send({ error: 'File too large (max 8MB)' });
    }

    let url: string;
    if (file.mimetype === 'image/svg+xml') {
      const filename = `${id}-${slot ?? 'desktop'}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.svg`;
      await fs.writeFile(path.join(BANNERS_DIR, filename), buffer);
      url = `/uploads/hero-banners/${filename}`;
    } else {
      const baseFilename = `${id}-${slot ?? 'desktop'}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const { largeFilename } = await optimizeAndSaveImage(buffer, { targetDir: BANNERS_DIR, baseFilename });
      url = `/uploads/hero-banners/${largeFilename}`;
    }

    const prevUrl = isMobile ? banner.imageUrlMobile : banner.imageUrlDesktop;
    await unlinkBannerImage(prevUrl);

    const updated = await fastify.prisma.heroBanner.update({
      where: { id },
      data: isMobile ? { imageUrlMobile: url } : { imageUrlDesktop: url },
    });
    return { banner: updated, url };
  });
}
```

- [ ] **Step 2: Register the route + serve uploads**

In `backend/src/app.ts`:

After line `await fastify.register(featureTileRoutes);` add:
```ts
    await fastify.register(heroBannerRoutes);
```

At the top of the file with the other route imports (next to `import { featureTileRoutes } from './routes/feature-tiles.js';`) add:
```ts
import { heroBannerRoutes } from './routes/hero-banners.js';
```

In the `PUBLIC_SLUGS` set, add `'hero-banners'`:
```ts
    const PUBLIC_SLUGS = new Set([
        'impressum',
        'polityka-prywatnosci',
        'regulamin',
        'polityka-cookies',
        'feature-tiles',
        'hero-banners',
        'migrated-images',
    ]);
```

- [ ] **Step 3: Write the route test**

Create `backend/src/routes/__tests__/hero-banners.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Hero banner routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.prisma.heroBanner.deleteMany({ where: { altText: { startsWith: 'TEST_BANNER' } } });
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.heroBanner.deleteMany({ where: { altText: { startsWith: 'TEST_BANNER' } } });
  });

  it('public endpoint returns only active banners, ordered by sortOrder', async () => {
    await app.prisma.heroBanner.create({
      data: { altText: 'TEST_BANNER_B', buttonLabel: 'B', buttonUrl: '/nowe', sortOrder: 2, isActive: true },
    });
    await app.prisma.heroBanner.create({
      data: { altText: 'TEST_BANNER_A', buttonLabel: 'A', buttonUrl: '/uzywane', sortOrder: 1, isActive: true },
    });
    await app.prisma.heroBanner.create({
      data: { altText: 'TEST_BANNER_HIDDEN', buttonLabel: 'H', buttonUrl: '/x', sortOrder: 0, isActive: false },
    });

    const res = await app.inject({ method: 'GET', url: '/api/hero-banners/public' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { banners: Array<{ altText: string; buttonLabel: string }> };
    const testBanners = body.banners.filter((b) => b.altText.startsWith('TEST_BANNER'));
    expect(testBanners.map((b) => b.altText)).toEqual(['TEST_BANNER_A', 'TEST_BANNER_B']);
  });

  it('admin list endpoint rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/hero-banners' });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd backend && npx vitest run src/routes/__tests__/hero-banners.test.ts
```
Expected: 2 passed. (If the first run fails because the Prisma client is stale, run `npx prisma generate` and retry.)

- [ ] **Step 5: Typecheck the backend**

Run:
```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/hero-banners.ts backend/src/app.ts backend/src/routes/__tests__/hero-banners.test.ts
git commit -m "feat(backend): hero banner CRUD/reorder/upload route"
```

---

### Task 3: API client + types

**Files:**
- Modify: `src/services/api.ts` (add after the `featureTilesApi` block, ~line 809)

- [ ] **Step 1: Add types + client**

In `src/services/api.ts`, after the closing `};` of `featureTilesApi`, add:

```ts
// Hero Banners API
export interface HeroBanner {
    id: string;
    imageUrlDesktop: string | null;
    imageUrlMobile: string | null;
    altText: string;
    buttonLabel: string;
    buttonUrl: string;
    buttonPositionYPct: number;
    buttonAlign: string;
    isActive: boolean;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface PublicHeroBanner {
    id: string;
    imageUrlDesktop: string | null;
    imageUrlMobile: string | null;
    altText: string;
    buttonLabel: string;
    buttonUrl: string;
    buttonPositionYPct: number;
    buttonAlign: string;
}

export type HeroBannerInput = Pick<
    HeroBanner,
    'altText' | 'buttonLabel' | 'buttonUrl' | 'buttonPositionYPct' | 'buttonAlign' | 'isActive'
>;

export const heroBannersApi = {
    listPublic: async (): Promise<{ banners: PublicHeroBanner[] }> => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/public`);
        if (!r.ok) throw new Error('Failed to fetch hero banners');
        return r.json();
    },
    listAdmin: async (token: string): Promise<{ banners: HeroBanner[] }> => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Failed to fetch hero banners');
        return r.json();
    },
    create: async (data: Partial<HeroBannerInput>, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to create banner');
        return json as { banner: HeroBanner };
    },
    update: async (id: string, data: Partial<HeroBannerInput>, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to update banner');
        return json as { banner: HeroBanner };
    },
    remove: async (id: string, token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to delete banner');
        }
        return true;
    },
    reorder: async (order: string[], token: string) => {
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ order }),
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to reorder');
        }
        return true;
    },
    uploadImage: async (id: string, file: File, slot: 'desktop' | 'mobile', token: string) => {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch(`${API_BASE_URL}/api/hero-banners/${id}/image?slot=${slot}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to upload image');
        return json as { banner: HeroBanner; url: string };
    },
};
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors referencing `api.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(frontend): heroBannersApi client and types"
```

---

### Task 4: Admin CMS page

**Files:**
- Create: `src/pages/admin/HeroBannersPage.tsx`
- Modify: `src/App.tsx` (lazy import ~line 38; route ~line 183)
- Modify: `src/components/admin/AdminSidebar.tsx` (nav array ~line 89)

- [ ] **Step 1: Write the admin page**

Create `src/pages/admin/HeroBannersPage.tsx`:

```tsx
import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { heroBannersApi, HeroBanner, HeroBannerInput } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2, Upload, GripVertical, Save } from 'lucide-react';
import {
    DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EMPTY_FORM: HeroBannerInput = {
    altText: '',
    buttonLabel: '',
    buttonUrl: '',
    buttonPositionYPct: 60,
    buttonAlign: 'left',
    isActive: true,
};

function SortableRow({
    banner, onEdit, onDelete, onUpload, uploadingKey,
}: {
    banner: HeroBanner;
    onEdit: (b: HeroBanner) => void;
    onDelete: (id: string) => void;
    onUpload: (id: string, slot: 'desktop' | 'mobile', file: File) => void;
    uploadingKey: string | null;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
            <button type="button" className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600" {...attributes} {...listeners} aria-label="Przeciągnij">
                <GripVertical className="w-5 h-5" />
            </button>
            <div className="w-28 h-16 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                {banner.imageUrlDesktop ? (
                    <img src={banner.imageUrlDesktop} alt={banner.altText} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">brak</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{banner.buttonLabel || '(bez przycisku)'}</p>
                <p className="text-xs text-slate-500 truncate">{banner.buttonUrl || '—'} · poz. {banner.buttonPositionYPct}% · {banner.buttonAlign}</p>
                {!banner.isActive && <span className="text-xs text-amber-600">(nieaktywny)</span>}
            </div>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                {uploadingKey === `${banner.id}:desktop` ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Desktop
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(banner.id, 'desktop', f); e.target.value = ''; }} />
            </label>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                {uploadingKey === `${banner.id}:mobile` ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Mobile
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(banner.id, 'mobile', f); e.target.value = ''; }} />
            </label>
            <Button variant="outline" size="sm" onClick={() => onEdit(banner)}>Edytuj</Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(banner.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
}

export default function HeroBannersPage() {
    const { token } = useAuth();
    const qc = useQueryClient();
    const [form, setForm] = React.useState<HeroBannerInput>(EMPTY_FORM);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [uploadingKey, setUploadingKey] = React.useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['hero-banners', 'admin'],
        queryFn: () => heroBannersApi.listAdmin(token!),
        enabled: !!token,
    });
    const banners = data?.banners || [];

    const createMut = useMutation({
        mutationFn: () => heroBannersApi.create(form, token!),
        onSuccess: () => { toast.success('Baner utworzony'); setForm(EMPTY_FORM); qc.invalidateQueries({ queryKey: ['hero-banners'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const updateMut = useMutation({
        mutationFn: (id: string) => heroBannersApi.update(id, form, token!),
        onSuccess: () => { toast.success('Baner zaktualizowany'); setForm(EMPTY_FORM); setEditingId(null); qc.invalidateQueries({ queryKey: ['hero-banners'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const deleteMut = useMutation({
        mutationFn: (id: string) => heroBannersApi.remove(id, token!),
        onSuccess: () => { toast.success('Baner usunięty'); qc.invalidateQueries({ queryKey: ['hero-banners'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const reorderMut = useMutation({
        mutationFn: (order: string[]) => heroBannersApi.reorder(order, token!),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-banners'] }),
        onError: (e: Error) => toast.error(e.message),
    });

    const handleUpload = async (id: string, slot: 'desktop' | 'mobile', file: File) => {
        try {
            setUploadingKey(`${id}:${slot}`);
            await heroBannersApi.uploadImage(id, file, slot, token!);
            qc.invalidateQueries({ queryKey: ['hero-banners'] });
            toast.success('Grafika zapisana');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setUploadingKey(null);
        }
    };

    const handleEdit = (b: HeroBanner) => {
        setEditingId(b.id);
        setForm({
            altText: b.altText, buttonLabel: b.buttonLabel, buttonUrl: b.buttonUrl,
            buttonPositionYPct: b.buttonPositionYPct, buttonAlign: b.buttonAlign, isActive: b.isActive,
        });
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const ids = banners.map((b) => b.id);
        const oldIdx = ids.indexOf(String(active.id));
        const newIdx = ids.indexOf(String(over.id));
        if (oldIdx < 0 || newIdx < 0) return;
        const newOrder = arrayMove(ids, oldIdx, newIdx);
        qc.setQueryData(['hero-banners', 'admin'], { banners: arrayMove(banners, oldIdx, newIdx) });
        reorderMut.mutate(newOrder);
    };

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Banery hero (strona główna Motolia)</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Grafiki przygotowujesz osobno (tekst wtopiony w obraz). CMS steruje przyciskiem: etykietą, linkiem i pozycją w pionie na desktopie.
                </p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>{editingId ? 'Edytuj baner' : 'Nowy baner'}</CardTitle>
                    <CardDescription>Najpierw zapisz baner, potem wgraj grafikę desktop/mobile na liście poniżej.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Opis grafiki (alt / SEO)</Label>
                            <Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} placeholder="np. Wyprzedaż aut premium" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Etykieta przycisku</Label>
                            <Input value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} placeholder="np. Sprawdź oferty" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Link przycisku</Label>
                            <Input value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} placeholder="/nowe?bodyType=SUV" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Wyrównanie przycisku (poziom)</Label>
                            <Select value={form.buttonAlign} onValueChange={(v) => setForm({ ...form, buttonAlign: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Do lewej</SelectItem>
                                    <SelectItem value="center">Wyśrodkowany</SelectItem>
                                    <SelectItem value="right">Do prawej</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Pozycja przycisku w pionie (desktop): {form.buttonPositionYPct}%</Label>
                        <Slider value={[form.buttonPositionYPct]} min={0} max={100} step={1}
                            onValueChange={(v) => setForm({ ...form, buttonPositionYPct: v[0] })} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="active" />
                        <Label htmlFor="active" className="cursor-pointer">Aktywny</Label>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => editingId ? updateMut.mutate(editingId) : createMut.mutate()}
                            disabled={!form.buttonLabel || !form.buttonUrl || createMut.isPending || updateMut.isPending}>
                            {(createMut.isPending || updateMut.isPending)
                                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                : editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {editingId ? 'Zapisz zmiany' : 'Dodaj baner'}
                        </Button>
                        {editingId && (
                            <Button variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Anuluj</Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Lista banerów ({banners.length})</CardTitle>
                    <CardDescription>Przeciągnij za uchwyt, żeby zmienić kolejność rotacji.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : banners.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">Brak banerów. Dodaj pierwszy powyżej.</p>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={banners.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {banners.map((banner) => (
                                        <SortableRow key={banner.id} banner={banner} onEdit={handleEdit}
                                            onDelete={(id) => { if (confirm('Usunąć baner?')) deleteMut.mutate(id); }}
                                            onUpload={handleUpload} uploadingKey={uploadingKey} />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Register the admin route**

In `src/App.tsx`, next to `const AdminFeatureTilesPage = lazy(() => import("./pages/admin/FeatureTilesPage"));` add:
```tsx
const AdminHeroBannersPage = lazy(() => import("./pages/admin/HeroBannersPage"));
```

After the `/admin/feature-tiles` `<Route>` block (closes at ~line 190), add:
```tsx
                        <Route
                          path="/admin/hero-banners"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <AdminHeroBannersPage />
                            </ProtectedRoute>
                          }
                        />
```

- [ ] **Step 3: Add the sidebar nav entry**

In `src/components/admin/AdminSidebar.tsx`, after the `'/admin/feature-tiles'` entry (line 89), add — reusing an already-imported icon (`LayoutGrid` is imported; use it or `Images` if imported):
```tsx
    { href: '/admin/hero-banners', label: 'Banery hero', icon: LayoutGrid, visibleTo: PLATFORM_ONLY },
```

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npx tsc --noEmit && npx eslint src/pages/admin/HeroBannersPage.tsx src/App.tsx src/components/admin/AdminSidebar.tsx
```
Expected: no errors. (If `Select`/`Slider` import paths differ, fix to match the actual files in `src/components/ui/`.)

- [ ] **Step 5: Manual verification**

Start the app (`npm run dev` + backend `cd backend && npm run dev`), log into `/admin/hero-banners`, create a banner, upload a desktop image, set button label/link/position, toggle active, drag to reorder. Confirm each persists after refresh.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/HeroBannersPage.tsx src/App.tsx src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): hero banners CMS page"
```

---

### Task 5: Public carousel component

**Files:**
- Create: `src/components/HeroBannerCarousel.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/HeroBannerCarousel.tsx`:

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { heroBannersApi } from '@/services/api';
import { OptimizedImage } from '@/components/OptimizedImage';
import {
    Carousel, CarouselContent, CarouselItem, CarouselApi,
} from '@/components/ui/carousel';

const YELLOW = '#F5C518';
const YELLOW_DARK = '#D4A90A';
const BLACK = '#1A1A1A';

const ALIGN_CLASS: Record<string, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
};

export function useHeroBanners() {
    return useQuery({
        queryKey: ['hero-banners', 'public'],
        queryFn: () => heroBannersApi.listPublic(),
        staleTime: 5 * 60 * 1000,
    });
}

export function HeroBannerCarousel() {
    const { data } = useHeroBanners();
    const banners = data?.banners ?? [];
    const [api, setApi] = React.useState<CarouselApi | null>(null);
    const [selected, setSelected] = React.useState(0);

    React.useEffect(() => {
        if (!api) return;
        const onSelect = () => setSelected(api.selectedScrollSnap());
        api.on('select', onSelect);
        onSelect();
        return () => { api.off('select', onSelect); };
    }, [api]);

    React.useEffect(() => {
        if (!api || banners.length <= 1) return;
        const id = setInterval(() => api.scrollNext(), 6000);
        return () => clearInterval(id);
    }, [api, banners.length]);

    if (banners.length === 0) return null;

    return (
        <div className="relative">
            <Carousel setApi={setApi} opts={{ loop: true }} className="overflow-hidden rounded-3xl">
                <CarouselContent>
                    {banners.map((b) => (
                        <CarouselItem key={b.id} className="basis-full">
                            <div className="relative w-full h-[360px] md:h-[460px] lg:h-[520px] bg-slate-900">
                                {b.imageUrlDesktop && (
                                    <OptimizedImage
                                        src={b.imageUrlDesktop}
                                        alt={b.altText}
                                        width="1600"
                                        height="700"
                                        className={`absolute inset-0 w-full h-full object-cover ${b.imageUrlMobile ? 'hidden md:block' : ''}`}
                                    />
                                )}
                                {b.imageUrlMobile && (
                                    <OptimizedImage
                                        src={b.imageUrlMobile}
                                        alt={b.altText}
                                        width="800"
                                        height="800"
                                        className="absolute inset-0 w-full h-full object-cover md:hidden"
                                    />
                                )}

                                {b.buttonLabel && b.buttonUrl && (
                                    <>
                                        {/* Desktop: button at configurable vertical position */}
                                        <div
                                            className={`hidden md:flex absolute left-0 right-0 px-10 lg:px-16 ${ALIGN_CLASS[b.buttonAlign] ?? 'justify-start'}`}
                                            style={{ top: `${b.buttonPositionYPct}%`, transform: 'translateY(-50%)' }}
                                        >
                                            <Link
                                                to={b.buttonUrl}
                                                className="inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5"
                                                style={{ background: YELLOW, color: BLACK, boxShadow: `0 4px 24px ${YELLOW}60` }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = YELLOW_DARK)}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = YELLOW)}
                                            >
                                                {b.buttonLabel}
                                            </Link>
                                        </div>
                                        {/* Mobile: button anchored near bottom */}
                                        <div className="flex md:hidden absolute bottom-6 left-0 right-0 px-6 justify-center">
                                            <Link
                                                to={b.buttonUrl}
                                                className="inline-flex items-center justify-center px-7 py-3.5 rounded-2xl font-bold text-base"
                                                style={{ background: YELLOW, color: BLACK }}
                                            >
                                                {b.buttonLabel}
                                            </Link>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {banners.map((b, i) => (
                        <button
                            key={b.id}
                            type="button"
                            aria-label={`Slajd ${i + 1}`}
                            onClick={() => api?.scrollTo(i)}
                            className="h-2 rounded-full transition-all"
                            style={{ width: selected === i ? 24 : 8, background: selected === i ? YELLOW : 'rgba(255,255,255,0.6)' }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
npx tsc --noEmit && npx eslint src/components/HeroBannerCarousel.tsx
```
Expected: no errors. (Verify `CarouselApi` is exported from `src/components/ui/carousel.tsx` — it is, per `export { type CarouselApi, ... }`. If `OptimizedImage` requires different props, match its signature as used in `FeatureTilesSection.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/HeroBannerCarousel.tsx
git commit -m "feat(frontend): public hero banner carousel component"
```

---

## Phase 2 — Hero integration

### Task 6: Wire carousel + search into the Motolia hero

**Files:**
- Modify: `src/pages/MotoliaHomePage.tsx` (hero `<section>`, lines ~177-256)

- [ ] **Step 1: Import the carousel + hook**

At the top of `src/pages/MotoliaHomePage.tsx`, with the other component imports, add:
```tsx
import { HeroBannerCarousel, useHeroBanners } from '@/components/HeroBannerCarousel';
```

- [ ] **Step 2: Read banner availability in the component**

Inside `MotoliaHomePage()`, after the existing `const { config } = useBrand();` line, add:
```tsx
  const { data: heroBannerData } = useHeroBanners();
  const hasHeroBanners = (heroBannerData?.banners?.length ?? 0) > 0;
```

- [ ] **Step 3: Branch the hero layout**

Replace the inner grid of the hero `<section>` (the `<div className="grid lg:grid-cols-[1.5fr_1fr] gap-16 items-center">` ... `</div>` block, lines ~186-254) with:

```tsx
          {hasHeroBanners ? (
            <div className="relative">
              <HeroBannerCarousel />
              {/* Floating search card (superauto layout) */}
              <FadeIn
                delay={0.2}
                className="mt-6 lg:mt-0 lg:absolute lg:top-1/2 lg:right-6 xl:right-10 lg:-translate-y-1/2 lg:w-[400px] lg:z-20"
              >
                <HeroVehicleFilter />
              </FadeIn>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-16 items-center">

              {/* Left col */}
              <div className="max-w-2xl">
                <FadeIn>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold mb-8"
                    style={{ background: `${YELLOW}20`, borderColor: `${YELLOW}60`, color: BLACK }}>
                    <span style={{ color: YELLOW_DARK }}>◆</span>
                    {config.homePage.hero.badge}
                  </div>
                </FadeIn>

                <FadeIn delay={0.1}>
                  <h1
                    className="text-5xl lg:text-7xl font-outfit font-bold tracking-tight mb-6 leading-[1.08] text-[#1A1A1A]"
                    dangerouslySetInnerHTML={{
                      __html: config.homePage.hero.title.replace('<span>', `<span style="color:${YELLOW_DARK}">`),
                    }}
                  />
                </FadeIn>

                <FadeIn delay={0.2}>
                  <p className="text-xl text-gray-500 mb-10 leading-relaxed font-light">
                    {config.homePage.hero.subtitle}
                  </p>
                </FadeIn>

                <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4 mb-12">
                  <Link
                    to="/samochody"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    style={{ background: YELLOW, color: BLACK, boxShadow: `0 4px 24px ${YELLOW}60` }}
                    onMouseEnter={e => (e.currentTarget.style.background = YELLOW_DARK)}
                    onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
                  >
                    {config.homePage.hero.ctaLabel}
                    <ArrowRight size={20} />
                  </Link>
                  <a
                    href="#jak-to-dziala"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-all duration-200"
                  >
                    Jak to działa?
                  </a>
                </FadeIn>

                <FadeIn delay={0.4} className="flex flex-wrap gap-x-8 gap-y-3">
                  {config.homePage.hero.trustBadges.map((badge, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-gray-600 text-sm font-medium">
                      <CheckCircle2 size={17} style={{ color: YELLOW_DARK }} />
                      {badge}
                    </div>
                  ))}
                </FadeIn>
              </div>

              {/* Right col — vehicle filter widget */}
              <FadeIn delay={0.4} className="relative">
                <HeroVehicleFilter />
              </FadeIn>

            </div>
          )}
```

> Note: this keeps the existing marketing hero verbatim as the no-banner fallback, so nothing regresses when zero banners are active. The `<section>` wrapper, glow divs, and `max-w-7xl` container around this block stay unchanged.

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npx tsc --noEmit && npx eslint src/pages/MotoliaHomePage.tsx
```
Expected: no errors. (`Link`, `ArrowRight`, `CheckCircle2`, `YELLOW`, `YELLOW_DARK`, `BLACK` are already imported/defined in this file.)

- [ ] **Step 5: Manual verification (golden path + fallback)**

1. With **no active banners**: load the Motolia home — hero shows the original marketing column + search (unchanged). 
2. In `/admin/hero-banners`, create 2 banners with desktop images, button labels/links, different vertical positions; mark active.
3. Reload home: hero shows the rotating carousel (auto-advances ~6s, dots clickable, loops), CTA button appears at the configured vertical position, and `HeroVehicleFilter` floats over the right side on desktop / stacks below on mobile.
4. Resize to mobile width: mobile image (if uploaded) shows, button anchored near bottom, search stacked below.
5. Click a banner CTA → navigates to its `buttonUrl`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MotoliaHomePage.tsx
git commit -m "feat(home): hero banner carousel + floating search on Motolia"
```

---

## Self-Review

**Spec coverage:**
- Separately-prepared graphics as hero → Tasks 1-5 (CMS) + Task 6 (render). ✓
- Mini-CMS controls button vertical position on desktop → `buttonPositionYPct` (model T1, admin slider T4, render `style={{ top }}` T5). ✓
- Mini-CMS controls button link → `buttonUrl` (T1/T3/T4/T5). ✓
- Carousel like superauto (`heroSwiper`) → shadcn `Carousel` + autoplay + dots (T5). ✓
- Search widget beside hero → `HeroVehicleFilter` floating card (T6). ✓
- Styles unchanged / yellow-only CTA → carousel button uses `#F5C518`/`#1A1A1A`; no green introduced. ✓
- Motolia-only → carousel rendered only in `MotoliaHomePage`; `HeroBanner` table is global but unused elsewhere. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; fallback hero copied verbatim rather than referenced.

**Type consistency:** `heroBannersApi` method names + `HeroBanner`/`PublicHeroBanner`/`HeroBannerInput` fields match across api.ts (T3), admin page (T4), and carousel (T5). `uploadImage(id, file, slot, token)` signature consistent between T3 and T4. `CarouselApi` imported from the shadcn wrapper. Field `buttonPositionYPct` spelled identically everywhere.

**Out of scope (later phases, confirmed with user):** section reorder/cuts (Phase 3), hot-deals chips + home calculator (Phase 4), mobile sticky search + bottom tab bar (Phase 5).
