import type { ConfigService } from '@nestjs/config';

export interface SettlementAsset {
  code: string;
  decimals: number;
}

export function getSettlementAsset(
  config: Pick<ConfigService, 'get'>,
): SettlementAsset {
  return {
    code: config.get<string>('SETTLEMENT_ASSET_CODE', 'XLM') ?? 'XLM',
    decimals: config.get<number>('SETTLEMENT_ASSET_DECIMALS', 7) ?? 7,
  };
}
