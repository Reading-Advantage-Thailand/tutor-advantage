import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock("./logger", () => ({ logger }));

describe("errorHandlerMiddleware", () => {
  beforeEach(() => {
    logger.error.mockClear();
    logger.warn.mockClear();
  });

  it("returns AppError details and logs client errors as warnings", async () => {
    const { AppError, errorHandlerMiddleware } = await import("./errorHandler");
    const req = { id: "req-1" };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const err = new AppError({
      message: "Bad input",
      statusCode: 400,
      code: "BAD_INPUT",
      details: { field: "email" },
    });

    errorHandlerMiddleware(err, req as never, res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "BAD_INPUT",
        message: "Bad input",
        requestId: "req-1",
        details: { field: "email" },
      },
    });
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("hides unexpected error details and logs server errors", async () => {
    const { errorHandlerMiddleware } = await import("./errorHandler");
    const req = { id: "req-2" };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    errorHandlerMiddleware(new Error("database exploded"), req as never, res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        requestId: "req-2",
      },
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
