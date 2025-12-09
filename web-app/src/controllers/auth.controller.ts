/**
 * Authentication Controller
 */
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'change-me-in-production') {
  console.error('CRITICAL: JWT_SECRET must be set to a secure value in production!');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET not configured for production');
  }
}

export class AuthController {
  constructor(private pool: Pool) {}

  async register(req: Request, res: Response): Promise<void> {
    try {
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      
      const { email, password, name, phone, whatsapp } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Check if user exists
      const existingUser = await this.pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await this.pool.query(
        'INSERT INTO users (email, password_hash, name, phone, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name',
        [email, passwordHash, name, phone, whatsapp]
      );

      const user = result.rows[0];

      // Generate JWT
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: '7d',
      });

      res.status(201).json({
        message: 'User registered successfully',
        user,
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Find user
      const result = await this.pool.query(
        'SELECT id, email, password_hash, name FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const user = result.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate JWT
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: '7d',
      });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
