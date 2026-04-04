export const reorderSuggestionMultiplier = 4;

export function getSuggestedReorderQuantity(minimumStock: number) {
  return Math.max(1, minimumStock * reorderSuggestionMultiplier);
}
