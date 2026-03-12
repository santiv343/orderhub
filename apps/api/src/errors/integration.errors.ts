import { ERROR_CODES } from '../constants/errors';
import { AppError } from './app.error';

export class InvalidApiKeyError extends AppError {
  constructor() {
    super(ERROR_CODES.API_KEY_INVALID, 'Invalid or missing API key', 401);
  }
}

export class ApiKeyNotFoundError extends AppError {
  constructor(id: string) {
    super(ERROR_CODES.API_KEY_NOT_FOUND, `API key ${id} not found`, 404);
  }
}
