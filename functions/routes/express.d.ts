import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            clientIp?: string; // Or string, depending on if it can be undefined
        }
    }
}