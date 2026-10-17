/**
 * Formats a price from the platform's smallest unit to a decimal string.
 * The default decimals are 7 (Stellar's standard), but this can be overridden
 * by passing a decimals parameter (typically from event or ticket type config).
 *
 * @param priceSmallestUnit - Price in smallest units (typically from chainTicketId or price field)
 * @param decimals - Number of decimal places (default: 7 for Stellar)
 * @returns Formatted price string with decimals
 */
export function formatPrice(
  priceSmallestUnit: bigint,
  decimals: number = 7,
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('Decimals must be an integer between 0 and 18');
  }

  const divisor = 10n ** BigInt(decimals);
  const isNegative = priceSmallestUnit < 0n;
  const absolutePrice = isNegative ? -priceSmallestUnit : priceSmallestUnit;
  const integerPart = absolutePrice / divisor;
  const fractionalPart = absolutePrice % divisor;
  const sign = isNegative ? '-' : '';

  if (decimals === 0) {
    return `${sign}${integerPart}`;
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return `${sign}${integerPart}.${fractionalStr}`;
}
