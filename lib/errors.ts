export const HTTP_ERRORS = {
  BAD_REQUEST: {
    message: 'Bad Request',
    statusCode: 400,
  },
  UNAUTHORIZED: {
    message: 'Unauthorized',
    statusCode: 401,
  },
  FORBIDDEN: {
    message: 'Forbidden',
    statusCode: 403,
  },
  NOT_FOUND: {
    message: 'Not Found',
    statusCode: 404,
  },
  INTERNAL: {
    message: 'Internal Server Error',
    statusCode: 500,
  },
  ALREADY_EXISTS: {
    message: 'Already Exists',
    statusCode: 409,
  }
} as const
