// src/middleware/rbac.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Department, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Secret key for signing JWTs
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// In-built list of pre-defined CEO emails/contacts for registration whitelist check
const ALLOWED_CEO_CONTACTS = (process.env.ALLOWED_CEO_CONTACTS || 'ceo@rebmaimpex.com,ceo2@rebmaimpex.com')
  .split(',')
  .map(email => email.trim().toLowerCase());

/**
 * Extended Request interface containing authenticated user context.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    department: Department;
    status: UserStatus;
    isCeo: boolean;
  };
}

/**
 * Middleware: Verifies JWT token, ensures user exists in database, and verifies active state.
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        department: true,
        status: true,
        isCeo: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User does not exist.' });
      return;
    }

    // Check if account status is ACTIVE. Block pending HR approvals or pending OTP verification
    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        error: 'Account inactive.',
        status: user.status,
        message: 'Your account requires HR approval or pending SMS OTP verification before you can access the system.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Middleware: Enforces department-based authorization policies.
 * @param allowedDepartments List of departments permitted to access the resource.
 * @param allowCeo If true, always bypasses restriction for CEO users.
 */
export function authorizeDepartments(
  allowedDepartments: Department[],
  allowCeo = true
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'User is not authenticated.' });
      return;
    }

    const { department, isCeo } = req.user;

    // CEO Bypass rule
    if (allowCeo && (isCeo || department === Department.CEO)) {
      return next();
    }

    // Standard department check (supports multiple users in the same department)
    if (!allowedDepartments.includes(department)) {
      res.status(403).json({
        error: 'Access Denied.',
        message: `Your department (${department}) is not permitted to access this resource. Required departments: [${allowedDepartments.join(', ')}]`,
      });
      return;
    }

    next();
  };
}

/**
 * Validator: Validates if a user attempting to sign up as CEO is whitelisted in-built.
 * This prevents unauthorized users from selecting the CEO department during signup.
 * @param email The registration email address to check.
 */
export function isWhitelistedCeo(email: string): boolean {
  return ALLOWED_CEO_CONTACTS.includes(email.trim().toLowerCase());
}

/**
 * Express middleware helper to check CEO registration whitelist before proceeding to user creation.
 */
export function validateCeoRegistration(req: Request, res: Response, next: NextFunction): void {
  const { email, department } = req.body;

  if (department === Department.CEO) {
    if (!email || !isWhitelistedCeo(email)) {
      res.status(403).json({
        error: 'Unauthorized Registration.',
        message: 'CEO department registrations are restricted to pre-defined company profiles. Please contact system support.',
      });
      return;
    }
  }

  next();
}
