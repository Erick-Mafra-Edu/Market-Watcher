/**
 * Authentication Middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'change-me-in-production') {
  console.error('CRITICAL: JWT_SECRET must be set to a secure value in production!');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET not configured for production');
  }
}

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

interface JWTPayload {
  userId: number;
  email: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
