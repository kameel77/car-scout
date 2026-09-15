import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public catalog dependency boundaries', () => {
  it('keeps the homepage synchronous while startup uses createRoot', () => {
    expect(source('src/main.tsx')).toContain('createRoot(');
    expect(source('src/App.tsx')).toMatch(/import HomePage from ["']\.\/pages\/HomePage["']/);
  });

  it.each(['SearchPage', 'ConditionPage'])('%s does not import the disabled rental stack', (page) => {
    const code = source(`src/pages/${page}.tsx`);
    expect(code).not.toMatch(/import[^;]*(RentalListingCard|rentalPublicApi)/);
    expect(code).not.toContain("queryKey: ['rental-search'");
  });

  it('keeps conditional financing and waitlist UI outside the SearchPage static closure', () => {
    const code = source('src/pages/SearchPage.tsx');

    expect(code).toContain("from '@/components/financing/useFinancingArticle'");
    expect(code).toContain("from '@/components/financing/splitLeadParagraph'");
    expect(code).toMatch(/React\.lazy\(\(\) =>\s*import\(['"]@\/components\/FinancingContentSection['"]\)/);
    expect(code).toMatch(/React\.lazy\(\(\) =>\s*import\(['"]@\/components\/PillarFinancingCalculator['"]\)/);
    expect(code).toMatch(/React\.lazy\(\(\) =>\s*import\(['"]@\/components\/WaitlistForm['"]\)/);
    expect(code).not.toMatch(/import\s+\{[^}]*FinancingContentSection[^}]*\}\s+from/);
    expect(code).not.toMatch(/import\s+\{[^}]*PillarFinancingCalculator[^}]*\}\s+from/);
    expect(code).not.toMatch(/import\s+\{[^}]*WaitlistForm[^}]*\}\s+from/);
  });
});
