import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AppError } from '../../errors/app.error';
import { ERROR_CODES } from '../../constants/errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof AppError) {
      return reply.status(exception.statusCode).send({
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as Record<string, unknown>;

      const message = Array.isArray(response['message'])
        ? (response['message'] as string[])[0]
        : (response['message'] as string) ?? exception.message;

      return reply.status(status).send({
        error: {
          code: response['error'] ?? ERROR_CODES.VALIDATION_ERROR,
          message,
        },
      });
    }

    return reply.status(500).send({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    });
  }
}
