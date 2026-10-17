import { formatPrice } from './currency';

describe('formatPrice', () => {
  it('should format price with default 7 decimals', () => {
    expect(formatPrice(BigInt('10000000'))).toBe('1.0000000');
    expect(formatPrice(BigInt('1000000'))).toBe('0.1000000');
    expect(formatPrice(BigInt('100'))).toBe('0.0000100');
  });

  it('should format price with custom decimals', () => {
    expect(formatPrice(BigInt('100'), 2)).toBe('1.00');
    expect(formatPrice(BigInt('1000'), 2)).toBe('10.00');
    expect(formatPrice(BigInt('50'), 2)).toBe('0.50');
  });

  it('formats a settlement asset amount using its configured decimals and code', () => {
    expect(formatPrice(1_234_500n, 6)).toBe('1.234500');
    expect(formatPrice(1_234_500n, 6) + ' USDC').toBe('1.234500 USDC');
  });

  it('should handle zero decimals', () => {
    expect(formatPrice(BigInt('1000'), 0)).toBe('1000');
    expect(formatPrice(BigInt('100'), 0)).toBe('100');
  });

  it('should handle zero price', () => {
    expect(formatPrice(BigInt('0'), 7)).toBe('0.0000000');
    expect(formatPrice(BigInt('0'), 2)).toBe('0.00');
    expect(formatPrice(BigInt('0'), 0)).toBe('0');
  });

  it('should handle large numbers', () => {
    expect(formatPrice(BigInt('999999999999999999'), 7)).toBe(
      '99999999999.9999999',
    );
  });

  it('should throw for negative decimals', () => {
    expect(() => formatPrice(BigInt('1000'), -1)).toThrow(
      'Decimals must be an integer between 0 and 18',
    );
  });

  it.each([1.5, 19])('rejects unsupported decimal counts: %s', (decimals) => {
    expect(() => formatPrice(1000n, decimals)).toThrow(
      'Decimals must be an integer between 0 and 18',
    );
  });

  it('formats negative prices without a negative fractional part', () => {
    expect(formatPrice(-150n, 2)).toBe('-1.50');
  });

  it('should pad fractional part with zeros', () => {
    expect(formatPrice(BigInt('1'), 7)).toBe('0.0000001');
    expect(formatPrice(BigInt('10'), 7)).toBe('0.0000010');
  });
});
