import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string;

  @IsInt()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  APP_URL: string;

  /// Soroban RPC endpoint the StellarService submits contract calls through.
  @IsString()
  SOROBAN_RPC_URL: string;

  @IsIn(['testnet', 'futurenet', 'mainnet'])
  STELLAR_NETWORK: string;

  /// Deployed `ticketing` contract's C... address.
  @IsString()
  TICKETING_CONTRACT_ID: string;

  /// Platform signer used for contract calls submitted on behalf of the
  /// backend itself (e.g. relaying an organizer's already-authorized op).
  @IsString()
  PLATFORM_SIGNER_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  return validated;
}
