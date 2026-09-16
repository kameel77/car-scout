import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyEmployeeAuth } from '../auth/employee-auth.middleware.js';
import {
  resolveRentalRateSource,
  getLowestRateGross,
  isRentalAllowedB2BOnly,
  RentalRateSource,
  ContractPartyOption,
  ResolvedRentalRateSource,
  EmployeeRentalCalculatedRow
} from './employee-rental-pricing.utils.js';

const getRentalOffersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  contractParty: z.enum(['CONSUMER', 'EMPLOYEE_B2B', 'EMPLOYER_COMPANY']).optional()
});

const getRentalOfferParamsSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100)
});

const getRentalOfferQuerySchema = z.object({
  contractParty: z.enum(['CONSUMER', 'EMPLOYEE_B2B', 'EMPLOYER_COMPANY']).optional()
});

const LIST_IMAGE_URLS_LIMIT = 5;

export async function employeeRentalCatalogRoutes(fastify: FastifyInstance) {
  // Scoped no-store hook for all employee rental catalog responses
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
  });

  // Scoped error handler to ensure unknown route exceptions return generic 500 without leaking db details
  fastify.setErrorHandler((error: any, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Nieprawidłowe parametry zapytania'
      });
    }

    if (error?.code === 'P2025') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Nieprawidłowy kursor paginacji'
      });
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    if (statusCode === 429) {
      return reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: error.message || 'Zbyt wiele żądań, spróbuj ponownie później'
      });
    }

    if (statusCode < 500) {
      return reply.code(statusCode).send({
        error:
          error.name ||
          (statusCode === 400
            ? 'Bad Request'
            : statusCode === 401
            ? 'Unauthorized'
            : statusCode === 403
            ? 'Forbidden'
            : statusCode === 404
            ? 'Not Found'
            : 'Error'),
        message: error.message || 'Wystąpił błąd żądania'
      });
    }

    fastify.log.error(error, 'Employee rental catalog internal error occurred');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Wystąpił wewnętrzny błąd serwera'
    });
  });

  // 1. GET /api/employee/rental-offers - Lista ofert najmu długoterminowego
  fastify.get(
    '/api/employee/rental-offers',
    {
      preHandler: [verifyEmployeeAuth],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const employee = (request as any).employee;
      const programId = employee.programId;

      const query = getRentalOffersQuerySchema.parse(request.query);
      const { limit, cursor, search, contractParty } = query;

      const program = await fastify.prisma.employeeProgram.findUnique({
        where: { id: programId },
        select: {
          id: true,
          scopeIncludeRental: true,
          matrixSets: {
            include: {
              matrixSet: {
                include: {
                  versions: {
                    where: { status: 'PUBLISHED' },
                    include: {
                      rows: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!program) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Program pracowniczy nie został znaleziony'
        });
      }

      // Gdy scopeIncludeRental = false, zwracamy pustą listę (200 OK)
      if (!program.scopeIncludeRental) {
        return reply.code(200).send({
          offers: [],
          nextCursor: null
        });
      }

      // Normalizacja kursora - usunięcie prefiksu rental-
      const vehicleCursor = cursor ? cursor.replace(/^rental-/, '') : undefined;

      const searchFilter =
        search && search.trim().length > 0
          ? {
              OR: [
                { make: { contains: search.trim(), mode: 'insensitive' as const } },
                { model: { contains: search.trim(), mode: 'insensitive' as const } },
                { version: { contains: search.trim(), mode: 'insensitive' as const } }
              ]
            }
          : {};

      const where: any = {
        isActive: true,
        isPublished: true,
        ...searchFilter,
        rentalAssignments: {
          some: {
            isActive: true,
            employeeProgramOffers: {
              none: {
                programId,
                isExcluded: true,
                isActive: true
              }
            }
          }
        }
      };

      const vehicles = await fastify.prisma.rentalVehicle.findMany({
        where,
        take: limit + 1,
        ...(vehicleCursor ? { cursor: { id: vehicleCursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          rentalAssignments: {
            where: {
              isActive: true,
              employeeProgramOffers: {
                none: {
                  programId,
                  isExcluded: true,
                  isActive: true
                }
              }
            },
            include: {
              rentalCompany: true,
              matrixEntries: true,
              employeeMatrixRows: true
            }
          }
        }
      });

      const hasMore = vehicles.length > limit;
      const pagedVehicles = hasMore ? vehicles.slice(0, limit) : vehicles;
      const nextCursor = hasMore ? pagedVehicles[pagedVehicles.length - 1].id : null;

      const offers = pagedVehicles
        .map((v) => {
          const eligibleAssignments = v.rentalAssignments || [];
          if (eligibleAssignments.length === 0) return null;

          let bestGrossRate: number | null = null;
          let bestRateSource: RentalRateSource = 'PUBLIC_MATRIX';
          let bestIsB2b = false;

          for (const asg of eligibleAssignments) {
            const resolved = resolveRentalRateSource({
              assignment: asg,
              programMatrixSets: program.matrixSets,
              contractParty: contractParty as ContractPartyOption | undefined
            });

            const lowestGross = getLowestRateGross(resolved.rows);
            if (lowestGross !== null) {
              const optionB2b = isRentalAllowedB2BOnly(resolved.allowedContractParties);
              if (bestGrossRate === null || lowestGross < bestGrossRate) {
                bestGrossRate = lowestGross;
                bestRateSource = resolved.rateSource;
                bestIsB2b = optionB2b;
              } else if (lowestGross === bestGrossRate && resolved.rateSource === 'EMPLOYEE_MATRIX') {
                bestRateSource = 'EMPLOYEE_MATRIX';
                bestIsB2b = optionB2b;
              }
            }
          }

          // Jeśli żadne przypisanie nie ma dostępnych stawek, pomijamy
          if (bestGrossRate === null) return null;

          const rawImages = Array.isArray(v.imageUrls) ? v.imageUrls : [];
          const primaryImage =
            v.primaryImageUrl || (rawImages.length > 0 ? rawImages[0] : null);

          return {
            id: `rental-${v.id}`,
            sourceType: 'RENTAL' as const,
            vehicle: {
              id: v.id,
              make: v.make,
              model: v.model,
              version: v.version ?? null,
              productionYear: v.productionYear ?? 2026,
              fuelType: v.fuelType ?? null,
              transmission: v.transmission ?? null,
              bodyType: v.bodyType ?? null,
              primaryImageUrl: primaryImage,
              imageUrls: rawImages.slice(0, LIST_IMAGE_URLS_LIMIT)
            },
            rental: {
              fromMonthlyRateGross: bestGrossRate,
              rateSource: bestRateSource,
              rentalCompanies: [],
              isB2b: bestIsB2b
            },
            benefit: null
          };
        })
        .filter((o): o is NonNullable<typeof o> => o !== null);

      return reply.code(200).send({
        offers,
        nextCursor
      });
    }
  );

  // 2. GET /api/employee/rental-offers/:id - Szczegóły oferty najmu i siatka wariantów
  fastify.get(
    '/api/employee/rental-offers/:id',
    {
      preHandler: [verifyEmployeeAuth],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const employee = (request as any).employee;
      const programId = employee.programId;

      const params = getRentalOfferParamsSchema.parse(request.params);
      const query = getRentalOfferQuerySchema.parse(request.query);
      const { contractParty } = query;

      const program = await fastify.prisma.employeeProgram.findUnique({
        where: { id: programId },
        select: {
          id: true,
          scopeIncludeRental: true,
          matrixSets: {
            include: {
              matrixSet: {
                include: {
                  versions: {
                    where: { status: 'PUBLISHED' },
                    include: {
                      rows: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!program || !program.scopeIncludeRental) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Oferta najmu nie została znaleziona'
        });
      }

      const vehicleId = params.id.replace(/^rental-/, '');

      const vehicle = await fastify.prisma.rentalVehicle.findFirst({
        where: {
          id: vehicleId,
          isActive: true,
          isPublished: true
        },
        include: {
          rentalAssignments: {
            where: {
              isActive: true,
              employeeProgramOffers: {
                none: {
                  programId,
                  isExcluded: true,
                  isActive: true
                }
              }
            },
            include: {
              rentalCompany: true,
              matrixEntries: true,
              employeeMatrixRows: true
            }
          }
        }
      });

      if (!vehicle || (vehicle.rentalAssignments || []).length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Oferta najmu nie została znaleziona'
        });
      }

      const rentalOptions = (vehicle.rentalAssignments || []).map((asg) => {
        const resolved = resolveRentalRateSource({
          assignment: asg,
          programMatrixSets: program.matrixSets,
          contractParty: contractParty as ContractPartyOption | undefined
        });

        const sortedRows = [...resolved.rows].sort((a, b) => {
          if (a.contractMonths !== b.contractMonths) return a.contractMonths - b.contractMonths;
          if (a.annualMileageKm !== b.annualMileageKm) return a.annualMileageKm - b.annualMileageKm;
          return a.initialPaymentPct - b.initialPaymentPct;
        });

        return {
          assignmentId: asg.id,
          rateSource: resolved.rateSource,
          matrixVersionId: resolved.matrixVersionId,
          allowedContractParties: resolved.allowedContractParties,
          isB2b: isRentalAllowedB2BOnly(resolved.allowedContractParties),
          rows: sortedRows
        };
      });

      // Wyznaczenie oferty B2B spójnie z listingiem - na podstawie najkorzystniejszego wariantu
      let bestOption = rentalOptions[0];
      let lowestGross = Infinity;
      for (const opt of rentalOptions) {
        const optMin = opt.rows.length > 0 ? Math.min(...opt.rows.map((r) => r.monthlyRateGross)) : Infinity;
        if (optMin < lowestGross) {
          lowestGross = optMin;
          bestOption = opt;
        }
      }
      const isOfferB2b = bestOption ? isRentalAllowedB2BOnly(bestOption.allowedContractParties) : false;

      const rawImages = Array.isArray(vehicle.imageUrls) ? vehicle.imageUrls : [];
      const primaryImage =
        vehicle.primaryImageUrl || (rawImages.length > 0 ? rawImages[0] : null);

      return reply.code(200).send({
        id: `rental-${vehicle.id}`,
        sourceType: 'RENTAL' as const,
        vehicle: {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          version: vehicle.version ?? null,
          productionYear: vehicle.productionYear ?? 2026,
          fuelType: vehicle.fuelType ?? null,
          transmission: vehicle.transmission ?? null,
          bodyType: vehicle.bodyType ?? null,
          primaryImageUrl: primaryImage,
          imageUrls: rawImages,
          doors: vehicle.doors ?? null,
          seats: vehicle.seats ?? null,
          powerHp: vehicle.enginePowerHp ?? null,
          engineCapacityCm3: vehicle.engineCapacityCm3 ?? null,
          equipmentSafety: vehicle.equipmentSafety ?? [],
          equipmentComfortExtras: vehicle.equipmentComfortExtras ?? [],
          equipmentAudioMultimedia: vehicle.equipmentAudioMultimedia ?? [],
          equipmentOther: vehicle.equipmentOther ?? [],
          color: vehicle.color ?? null,
          drive: vehicle.drive ?? null,
          specsJson: vehicle.specsJson ?? null,
          additionalInfoHeader: vehicle.additionalInfoHeader ?? null,
          additionalInfoContent: vehicle.additionalInfoContent ?? null
        },
        isB2b: isOfferB2b,
        rentalOptions,
        benefit: null
      });
    }
  );
}
