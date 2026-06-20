# Secrets and logging findings — mimo-v2.5-free

| # | File | Line | Severity | Issue |
|---|------|------|----------|-------|
| 1 | `backend/src/routes/auth.ts` | 273-276 | HIGH | Password reset token logged to console |
| 2 | `backend/src/routes/financing.ts` | 180-183 | HIGH | API key prefix logged; combined with Shop UUID leaks useful partial credential |
| 3 | `backend/src/middleware/partnerAuth.ts` | 29 | MEDIUM | Partner API key prefix logged on failed auth attempt |
| 4 | `backend/src/routes/financing.ts` | 228-229 | MEDIUM | Full Inbank response forwarded to client on error path |
| 5 | `backend/src/routes/financing.ts` | 376-378 | MEDIUM | Full Vehis response logged to console on every calculation |
| 6 | `backend/src/services/email.ts` | 85-86 | LOW | Nodemailer debug mode enabled in production |

Model: opencode/mimo-v2.5-free
