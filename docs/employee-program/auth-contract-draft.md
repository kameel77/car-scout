# Employee Program Auth & CSRF Contract Draft (P3a)

**Status:** Confirmed / Active Contract
**Target Clients:** `apps/employee-portal` and Frontend Workers
**Author:** Backend Worker (P3a)
**Date:** 2026-09-10

---

## 1. Authentication Overview

The Employee Program uses strictly isolated, cookie-based sessions with signed Double-Submit Cookie CSRF protection.
- **Session Mechanism:** Host-only `HttpOnly; Secure; SameSite=Lax; Path=/` cookie named `__Host-ep-session`.
- **Bearer Tokens / JSON Tokens:** **NEVER** returned in login/register responses and **NEVER** accepted in requests. All protected employee routes read the session cookie.
- **JWT Claims:** Signed with `realm: "employee"`, `aud: "employee-portal"`, and a unique `jti` (UUID). The `jti` is checked against a Redis session allowlist.
- **TTL:** 7 days (604800 seconds).

---

## 2. CSRF Protection Contract

- **CSRF Token Generation:**
  - Token is a cryptographically signed JWT issued by `fastify.jwt` with dedicated realm (`realm: "employee-csrf"`), audience (`aud: "employee-csrf"`), random UUID `nonce`, and finite integer expiration (`exp`).
  - Backend sets cookie: `__Host-ep-csrf` with `Path=/; SameSite=Strict; Secure`. Notice: `HttpOnly=false` so client-side JavaScript can read it.
- **CSRF Token Transport & Origin Verification:**
  - On all mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`), client must send the token in header:
    `X-CSRF-Token: <token>`
  - The middleware verifies:
    1. Header `X-CSRF-Token` matches cookie `__Host-ep-csrf`.
    2. Cryptographic signature and claims (`realm: "employee-csrf"`, `aud: "employee-csrf"`, valid `nonce`, unexpired `exp`) are verified via `fastify.jwt.verify`.
    3. Strict HTTPS Origin: exact match `https://${Host}`.
    4. If `Origin` is absent, requires `Referer` matching exact `https://${Host}`.
    5. Missing both `Origin` and `Referer` denies request (`403 Forbidden`).
    6. Malformed, `null`, non-HTTPS (e.g. `http://`), or cross-site `Origin`/`Referer` are strictly denied (`403 Forbidden`).
    7. Rejection of `Sec-Fetch-Site: cross-site`.
- **CSRF Bootstrap Endpoint:**
  - `GET /api/employee/auth/csrf`
  - Returns `200 OK` with JSON:
    ```json
    {
      "csrfToken": "...",
      "headerName": "X-CSRF-Token"
    }
    ```
  - Reuses valid existing unexpired CSRF JWT cookie if present to prevent multi-tab race conditions; sets `__Host-ep-csrf` cookie when fresh.

---

## 3. Endpoints Specification

### 3.1. `GET /api/employee/auth/csrf`
- **Purpose:** Bootstraps or refreshes CSRF token.
- **Auth required:** No.
- **Response `200 OK`:**
  ```json
  {
    "csrfToken": "1a2b3c...",
    "headerName": "X-CSRF-Token"
  }
  ```
- **Cookie set:** `__Host-ep-csrf=<token>; Path=/; SameSite=Strict; Secure; Max-Age=604800`

---

### 3.2. `POST /api/employee/auth/validate-code`
- **Purpose:** Pre-validates company registration code before showing registration form.
- **Auth required:** No.
- **CSRF required:** No.
- **Request Body:**
  ```json
  {
    "code": "ACTION-BENEFIT-2026"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "valid": true,
    "companyId": "...",
    "companyName": "Action S.A.",
    "programId": "...",
    "programName": "Action Auto Program"
  }
  ```

---

### 3.3. `POST /api/employee/auth/register`
- **Purpose:** Registers a new employee account with company code, establishes session.
- **Auth required:** No.
- **CSRF required:** Yes (`X-CSRF-Token` header + `__Host-ep-csrf` cookie).
- **Request Body:**
  ```json
  {
    "code": "ACTION-BENEFIT-2026",
    "email": "jan.kowalski@action.pl",
    "password": "Password123!",
    "firstName": "Jan",
    "lastName": "Kowalski",
    "phone": "+48123456789"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "employee": {
      "id": "acc_...",
      "email": "jan.kowalski@action.pl",
      "firstName": "Jan",
      "lastName": "Kowalski",
      "phone": "+48123456789",
      "company": {
        "id": "comp_...",
        "name": "Action S.A.",
        "slug": "action"
      },
      "program": {
        "id": "prog_...",
        "name": "Action Auto Program",
        "slug": "action-auto"
      },
      "createdAt": "2026-09-10T..."
    }
  }
  ```
- **Cookies set:**
  - `__Host-ep-session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  - `__Host-ep-csrf=<csrfToken>; Secure; SameSite=Strict; Path=/; Max-Age=604800`

---

### 3.4. `POST /api/employee/auth/login`
- **Purpose:** Authenticates employee and establishes session.
- **Auth required:** No.
- **CSRF required:** Yes (`X-CSRF-Token` header + `__Host-ep-csrf` cookie).
- **Request Body:**
  ```json
  {
    "email": "jan.kowalski@action.pl",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "employee": {
      "id": "acc_...",
      "email": "jan.kowalski@action.pl",
      "firstName": "Jan",
      "lastName": "Kowalski",
      "phone": "+48123456789",
      "company": {
        "id": "comp_...",
        "name": "Action S.A.",
        "slug": "action"
      },
      "program": {
        "id": "prog_...",
        "name": "Action Auto Program",
        "slug": "action-auto"
      }
    }
  }
  ```
- **Cookies set:**
  - `__Host-ep-session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  - `__Host-ep-csrf=<csrfToken>; Secure; SameSite=Strict; Path=/; Max-Age=604800`

---

### 3.5. `GET /api/employee/auth/me`
- **Purpose:** Fetches current authenticated employee profile and verifies session & active membership.
- **Auth required:** Yes (`__Host-ep-session` cookie).
- **CSRF required:** No (Safe GET method).
- **Response `200 OK`:**
  ```json
  {
    "employee": {
      "id": "acc_...",
      "email": "jan.kowalski@action.pl",
      "firstName": "Jan",
      "lastName": "Kowalski",
      "phone": "+48123456789",
      "company": {
        "id": "comp_...",
        "name": "Action S.A.",
        "slug": "action"
      },
      "program": {
        "id": "prog_...",
        "name": "Action Auto Program",
        "slug": "action-auto"
      },
      "createdAt": "2026-09-10T..."
    }
  }
  ```
- **Response `401 Unauthorized`:** If session cookie is missing, invalid, expired, or invalidated in Redis.
- **Response `403 Forbidden`:** If employee account, membership, company, or program is deactivated or companyId/programId claim mismatch.

---

### 3.6. `POST /api/employee/auth/logout`
- **Purpose:** Invalidates session in Redis allowlist and clears cookies.
- **Auth required:** Yes (`__Host-ep-session` cookie).
- **CSRF required:** Yes (`X-CSRF-Token` header + `__Host-ep-csrf` cookie).
- **Response `200 OK`:**
  ```json
  {
    "message": "Wylogowano pomyślnie"
  }
  ```
- **Cookies set (cleared):**
  - `__Host-ep-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  - `__Host-ep-csrf=; Secure; SameSite=Strict; Path=/; Max-Age=0`
