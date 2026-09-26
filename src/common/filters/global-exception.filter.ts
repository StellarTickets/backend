import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../errors/domain.error';

const PRISMA_CODE_TO_STATUS: Readonly<Record<string, number>> = {
  P2002: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
};

const DOMAIN_CODE_TO_STATUS: Readonly<Record<string, number>> = {
  LISTING_INACTIVE: HttpStatus.BAD_REQUEST,
  TICKET_TYPE_SOLD_OUT: HttpStatus.CONFLICT,
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      statusCode =
        PRISMA_CODE_TO_STATUS[exception.code] ??
        HttpStatus.INTERNAL_SERVER_ERROR;
      code = `PRISMA_${exception.code}`;
      message = this.getPrismaErrorMessage(exception);
    } else if (exception instanceof DomainError) {
      statusCode =
        DOMAIN_CODE_TO_STATUS[exception.code] ??
        HttpStatus.INTERNAL_SERVER_ERROR;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'PRISMA_VALIDATION_ERROR';
      message = 'Invalid data provided';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'PRISMA_INITIALIZATION_ERROR';
      message = 'Database connection failed';
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message,
    });
  }

  private getPrismaErrorMessage(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    switch (error.code) {
      case 'P2002':
        return 'A record with this value already exists';
      case 'P2025':
        return 'Record not found';
      default:
        return 'Database operation failed';
    }
  }
}
