import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requirePermission } from '../middleware/permissions.js';

export async function widgetRoutes(fastify: FastifyInstance) {
  // --- Admin Routes ---
  
  fastify.get('/api/admin/widgets', {
    preHandler: [fastify.authenticate, requirePermission('content:read')]
  }, async (request, reply) => {
    const widgets = await fastify.prisma.widget.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return widgets;
  });

  fastify.post('/api/admin/widgets', {
    preHandler: [fastify.authenticate, requirePermission('content:write')]
  }, async (request, reply) => {
    const schema = z.object({
      name: z.string(),
      isActive: z.boolean(),
      placement: z.enum(['HOME', 'OFFER', 'RENTAL', 'STATIC', 'EXTERNAL']),
      vehicleSources: z.array(z.string()),
      selectionMode: z.enum(['FEATURED', 'FILTERED']),
      filterParams: z.any().optional(),
      layoutStyle: z.string().default('carousel')
    });
    const data = schema.parse(request.body);
    const widget = await fastify.prisma.widget.create({ data });
    return widget;
  });

  fastify.put('/api/admin/widgets/:id', {
    preHandler: [fastify.authenticate, requirePermission('content:write')]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      isActive: z.boolean().optional(),
      placement: z.enum(['HOME', 'OFFER', 'RENTAL', 'STATIC', 'EXTERNAL']).optional(),
      vehicleSources: z.array(z.string()).optional(),
      selectionMode: z.enum(['FEATURED', 'FILTERED']).optional(),
      filterParams: z.any().optional(),
      layoutStyle: z.string().optional()
    });
    const data = schema.parse(request.body);
    const widget = await fastify.prisma.widget.update({
      where: { id },
      data
    });
    return widget;
  });

  fastify.delete('/api/admin/widgets/:id', {
    preHandler: [fastify.authenticate, requirePermission('content:write')]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.widget.delete({ where: { id } });
    return { success: true };
  });

  // --- Public Routes ---

  fastify.get('/api/widgets/render', async (request, reply) => {
    const { placement, widgetId } = request.query as { placement?: string; widgetId?: string };
    
    const where: Prisma.WidgetWhereInput = { isActive: true };
    if (placement) {
      where.placement = placement as any;
    }
    if (widgetId) {
      where.id = widgetId;
    }
    
    const widgets = await fastify.prisma.widget.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const results = [];

    for (const w of widgets) {
      let queryNew = false;
      let queryUsed = false;
      let queryRental = false;
      
      if (w.vehicleSources.includes('NEW')) queryNew = true;
      if (w.vehicleSources.includes('USED')) queryUsed = true;
      if (w.vehicleSources.includes('RENTAL')) queryRental = true;

      let unifiedVehicles: any[] = [];
      const sourcesQuery: string[] = [];
      if (queryNew) sourcesQuery.push('new');
      if (queryUsed) sourcesQuery.push('used');

      if (w.selectionMode === 'FEATURED') {
        if (sourcesQuery.length > 0) {
          const listings = await fastify.prisma.listing.findMany({
             where: {
               isFeatured: true,
               isArchived: false,
               pricePln: { gt: 0 }
             },
             take: 12
          });
          const formatted = listings.map(l => ({
             id: l.id,
             title: `${l.make} ${l.model}`,
             brand: l.make,
             model: l.model,
             bodyType: l.bodyType,
             year: l.productionYear,
             mileage: l.mileageKm,
             fuelType: l.fuelType,
             transmission: l.transmission,
             price: l.pricePln,
             imageUrl: l.imageUrls[0] || '',
             url: `/oferta/${l.slug ?? l.id}`,
             condition: l.condition,
             version: l.version,
             enginePowerHp: l.enginePowerHp,
             catalogPrice: l.catalogPrice,
             motoliaDiscountPln: l.motoliaDiscountPln,
             showMotoliaDiscount: l.showMotoliaDiscount,
             creditInstallment: l.referenceCreditInstallment,
             leasingInstallment: l.referenceLeasingInstallment,
             marketingTags: l.marketingTags
          }));
          unifiedVehicles.push(...formatted);
        }

        if (queryRental) {
          const rentalVehicles = await fastify.prisma.rentalVehicle.findMany({
             where: { isFeatured: true, isActive: true },
             take: 12,
             include: {
               rentalAssignments: {
                 include: { matrixEntries: true }
               }
             }
          });
          const formattedRentals = rentalVehicles.map(r => {
             let minInstallment = null;
             for (const asgmnt of r.rentalAssignments) {
               for (const entry of asgmnt.matrixEntries) {
                 if (minInstallment === null || entry.monthlyRateGross < minInstallment) {
                   minInstallment = entry.monthlyRateGross;
                 }
               }
             }
             return {
               id: r.id,
             title: `${r.make} ${r.model}`,
             brand: r.make,
             model: r.model,
             version: r.version,
             enginePowerHp: r.enginePowerHp,
             bodyType: r.bodyType,
             year: r.productionYear,
             mileage: 0,
             fuelType: r.fuelType,
             transmission: r.transmission,
             price: r.catalogPrice,
             installment: minInstallment,
             imageUrl: r.imageUrls[0] || '',
             url: `/wynajem-dlugoterminowy/${r.slug ?? r.id}`
          };
          });
          unifiedVehicles.push(...formattedRentals);
        }
      } else { // FILTERED mode
        const params = (w.filterParams as any) || {};

        if (sourcesQuery.length > 0) {
          const listingWhere: Prisma.ListingWhereInput = { isArchived: false };
          if (params.bodyType && params.bodyType.length > 0) listingWhere.bodyType = { in: params.bodyType };
          if (params.brand && params.brand.length > 0) listingWhere.make = { in: params.brand };
          // if (params.category && params.category.length > 0) listingWhere.category = { in: params.category }; // Listing doesn't have category
          listingWhere.pricePln = { gt: 0 };
          if (params.minPrice) listingWhere.pricePln.gte = Math.max(1, Number(params.minPrice));
          if (params.maxPrice) listingWhere.pricePln.lte = Number(params.maxPrice);
          if (params.minYear) listingWhere.productionYear = { gte: Number(params.minYear) };

          const listings = await fastify.prisma.listing.findMany({
             where: listingWhere,
             take: 12,
             orderBy: { createdAt: 'desc' }
          });
          const formatted = listings.map(l => ({
             id: l.id,
             title: `${l.make} ${l.model}`,
             brand: l.make,
             model: l.model,
             bodyType: l.bodyType,
             year: l.productionYear,
             mileage: l.mileageKm,
             fuelType: l.fuelType,
             transmission: l.transmission,
             price: l.pricePln,
             imageUrl: l.imageUrls[0] || '',
             url: `/oferta/${l.slug ?? l.id}`,
             condition: l.condition,
             version: l.version,
             enginePowerHp: l.enginePowerHp,
             catalogPrice: l.catalogPrice,
             motoliaDiscountPln: l.motoliaDiscountPln,
             showMotoliaDiscount: l.showMotoliaDiscount,
             creditInstallment: l.referenceCreditInstallment,
             leasingInstallment: l.referenceLeasingInstallment,
             marketingTags: l.marketingTags
          }));
          unifiedVehicles.push(...formatted);
        }

        if (queryRental) {
          const rentalWhere: Prisma.RentalVehicleWhereInput = { isActive: true };
          if (params.bodyType && params.bodyType.length > 0) rentalWhere.bodyType = { in: params.bodyType };
          if (params.brand && params.brand.length > 0) rentalWhere.make = { in: params.brand };
          if (params.minYear) rentalWhere.productionYear = { gte: Number(params.minYear) };

          const rentals = await fastify.prisma.rentalVehicle.findMany({
             where: rentalWhere,
             take: 12,
             orderBy: { createdAt: 'desc' },
             include: {
               rentalAssignments: {
                 include: { matrixEntries: true }
               }
             }
          });
          const formattedRentals = rentals.map(r => {
             let minInstallment = null;
             for (const asgmnt of r.rentalAssignments) {
               for (const entry of asgmnt.matrixEntries) {
                 if (minInstallment === null || entry.monthlyRateGross < minInstallment) {
                   minInstallment = entry.monthlyRateGross;
                 }
               }
             }
             return {
               id: r.id,
             title: `${r.make} ${r.model}`,
             brand: r.make,
             model: r.model,
             version: r.version,
             enginePowerHp: r.enginePowerHp,
             bodyType: r.bodyType,
             year: r.productionYear,
             mileage: 0,
             fuelType: r.fuelType,
             transmission: r.transmission,
             price: r.catalogPrice,
             installment: minInstallment,
             imageUrl: r.imageUrls[0] || '',
             url: `/wynajem-dlugoterminowy/${r.slug ?? r.id}`
          };
          });
          unifiedVehicles.push(...formattedRentals);
        }
      }

      // Simple randomize
      unifiedVehicles = unifiedVehicles.sort(() => 0.5 - Math.random()).slice(0, 12);

      results.push({
        ...w,
        vehicles: unifiedVehicles
      });
    }

    return results;
  });
}
