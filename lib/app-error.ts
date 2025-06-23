export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }

  static from(errorConstant: { message: string; statusCode: number }) {
    return new AppError(errorConstant.message, errorConstant.statusCode)
  }
}