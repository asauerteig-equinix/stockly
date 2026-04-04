export const reorderSuggestionMultiplier = 4;

export function getSuggestedReorderQuantity(quantity: number, minimumStock: number, lowStockBuffer: number) {
  const baseQuantity = Math.max(1, minimumStock + lowStockBuffer - quantity);
  return baseQuantity * reorderSuggestionMultiplier;
}
