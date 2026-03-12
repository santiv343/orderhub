import { ERROR_CODES } from '../constants/errors';
import { AppError } from './app.error';

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(ERROR_CODES.AUTH_INVALID_CREDENTIALS, 'Invalid credentials', 401);
  }
}

export class UserAlreadyExistsError extends AppError {
  constructor(email: string) {
    super(ERROR_CODES.USER_ALREADY_EXISTS, `User with email ${email} already exists`, 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(ERROR_CODES.AUTH_UNAUTHORIZED, 'Unauthorized', 401);
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super(ERROR_CODES.AUTH_TOKEN_INVALID, 'Token is invalid or expired', 401);
  }
}
