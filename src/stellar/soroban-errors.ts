import { BadRequestException, HttpException } from '@nestjs/common';

export interface SorobanErrorMapping {
  status: number;
  message: string;
  code: string;
}

export const SOROBAN_ERROR_MAP: Record<number, SorobanErrorMapping> = {
  1: { status: 409, message: 'Ticket type is sold out', code: 'TICKET_TYPE_SOLD_OUT' },
  2: { status: 400, message: 'Invalid ticket price or resale price exceeds cap', code: 'INVALID_PRICE' },
  3: { status: 403, message: 'Caller is not authorized to perform this operation', code: 'UNAUTHORIZED' },
  4: { status: 404, message: 'Event or ticket not found on-chain', code: 'NOT_FOUND' },
  5: { status: 400, message: 'Invalid ticket state for this action', code: 'INVALID_STATE' },
};

export function parseSorobanErrorCode(errorMsg: string): number | null {
  const match = errorMsg.match(/Error\(Contract,\s*#(\d+)\)/) || errorMsg.match(/contract error\s*#?(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

export function mapSorobanErrorToApiException(errorMsg: string): HttpException {
  const codeNum = parseSorobanErrorCode(errorMsg);
  if (codeNum !== null && SOROBAN_ERROR_MAP[codeNum]) {
    const mapped = SOROBAN_ERROR_MAP[codeNum];
    return new HttpException(
      {
        statusCode: mapped.status,
        message: mapped.message,
        error: mapped.code,
      },
      mapped.status,
    );
  }
  return new BadRequestException(`Soroban contract error: ${errorMsg}`);
}
