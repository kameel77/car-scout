export const calculateRatesWithInsurance = (entry: any, assignment: any) => {
    const insuranceAddMode = assignment.insuranceAddModeOverride || assignment.rentalCompany?.insuranceAddMode || 'INSURANCE_23';
    const servicesIncluded = (assignment.includedServicesOverride && assignment.includedServicesOverride.length > 0)
        ? assignment.includedServicesOverride
        : (assignment.rentalCompany?.includedServices && assignment.rentalCompany.includedServices.length > 0
            ? assignment.rentalCompany.includedServices
            : (entry.servicesIncluded || []));

    let finalNet = entry.monthlyRateNet;
    let finalGross = entry.monthlyRateGross;
    if (entry.insuranceNet) {
        if (insuranceAddMode === 'INSURANCE_23') {
            finalNet += entry.insuranceNet;
            finalGross += (entry.insuranceNet * 1.23);
        } else if (insuranceAddMode === 'INSURANCE_0') {
            finalNet += entry.insuranceNet;
            finalGross += entry.insuranceNet;
        } else if (insuranceAddMode === 'INSURANCE_INCLUDED') {
            // Insurance is already included in monthlyRateNet & monthlyRateGross
            // Do not add entry.insuranceNet again
        }
    }
    return { ...entry, monthlyRateNet: finalNet, monthlyRateGross: finalGross, servicesIncluded };
};
