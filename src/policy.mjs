const round = (value) => Math.round(value * 100) / 100;
export const buildReplenishmentPlan = (request) => {
  const useBeforeDays = request.planningLeadDays + request.reviewPeriodDays;
  const usableBatches = request.onHandBatches.filter((batch) => batch.daysToExpiry > request.planningLeadDays);
  const expiryRiskBatches = usableBatches.filter((batch) => batch.daysToExpiry <= useBeforeDays);
  const usableUnits = usableBatches.reduce((total, batch) => total + batch.units, 0);
  const expiryRiskUnits = expiryRiskBatches.reduce((total, batch) => total + batch.units, 0);
  const leadDemandUnits = request.dailyDemandUnits * request.planningLeadDays;
  const targetStockUnits = request.dailyDemandUnits * (request.planningLeadDays + request.reviewPeriodDays + request.safetyDays);
  const projectedUnitsAtArrival = Math.max(0, usableUnits - leadDemandUnits);
  const recommendedOrderUnits = Math.max(0, targetStockUnits - projectedUnitsAtArrival);
  const eligible = []; const exclusions = [];
  for (const supplier of request.supplierOptions) { if (supplier.leadDays > request.planningLeadDays) exclusions.push({ supplierId: supplier.supplierId, reason: 'lead_time_exceeded' }); else if (supplier.guaranteedShelfLifeDays <= useBeforeDays) exclusions.push({ supplierId: supplier.supplierId, reason: 'shelf_life_insufficient' }); else eligible.push(supplier); }
  eligible.sort((left, right) => left.unitCost - right.unitCost || left.leadDays - right.leadDays || right.guaranteedShelfLifeDays - left.guaranteedShelfLifeDays || left.supplierId.localeCompare(right.supplierId));
  let remaining = recommendedOrderUnits; const orderLines = eligible.map((supplier) => { const orderedUnits = Math.min(remaining, supplier.availableUnits); remaining -= orderedUnits; return { supplierId: supplier.supplierId, supplierName: supplier.supplierName, orderedUnits, unitCost: supplier.unitCost, leadDays: supplier.leadDays, lineCost: round(orderedUnits * supplier.unitCost) }; }).filter((line) => line.orderedUnits > 0);
  return { useBeforeDays, usableUnits, expiryRiskUnits, leadDemandUnits, targetStockUnits, projectedUnitsAtArrival, recommendedOrderUnits, orderLines, exclusions, unfilledOrderUnits: remaining, estimatedOrderCost: round(orderLines.reduce((total, line) => total + line.lineCost, 0)), fullySourced: remaining === 0, exceptionReasons: [...(expiryRiskUnits > 0 ? ['on_hand_expiry_risk'] : []), ...(remaining > 0 ? ['insufficient_shelf_life_qualified_supply'] : [])] };
};
