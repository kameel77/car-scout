# Car Scout Backend

Backend API for Car Scout application built with Fastify, Prisma, and PostgreSQL.

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials

4. Generate Prisma client:
```bash
npm run prisma:generate
```

5. Run migrations:
```bash
npm run prisma:migrate
```

6. Seed database:
```bash
npm run prisma:seed
```

## Development

Start development server:
```bash
npm run dev
```

Server will run on `http://localhost:3000`

## Default Admin Credentials

- Email: `admin@carscout.pl`
- Password: `admin123`

**⚠️ Change these in production!**

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### CSV Import
- `POST /api/import/csv` - Upload CSV file
- `POST /api/import/csv-data` - Upload JSON data
- `GET /api/import/history` - Get import history

### Listings
- `GET /api/listings` - Get all listings
- `GET /api/listings/:id` - Get single listing
- `POST /api/listings` - Create listing (admin)
- `PUT /api/listings/:id` - Update listing (admin)

### Analytics
- `GET /api/analytics/price-trends` - Get price trends

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:migrate` - Run migrations
- `npm run prisma:seed` - Seed database
