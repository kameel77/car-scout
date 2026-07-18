-- RentalVehicle: wyróżnienie w ofercie dla firm (/dla-firm)
ALTER TABLE "rental_vehicles" ADD COLUMN "is_business_featured" BOOLEAN NOT NULL DEFAULT false;
