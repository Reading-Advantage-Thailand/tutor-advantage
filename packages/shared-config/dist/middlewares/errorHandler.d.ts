import { Request, Response, NextFunction } from "express";
export interface AppErrorOptions {
    message: string;
    statusCode: number;
    code?: string;
    details?: any;
}
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details: any;
    constructor(options: AppErrorOptions);
}
export declare const errorHandlerMiddleware: (err: Error, req: Request, res: Response, next: NextFunction) => void;
