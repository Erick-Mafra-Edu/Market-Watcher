/**
 * Alerts Controller
 */
import { Response } from 'express';
import { Pool } from 'pg';
import { AuthRequest } from '../middleware/auth.middleware';

export class AlertsController {
  constructor(private pool: Pool) {}

  async getAlerts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await this.pool.query(
        `SELECT a.id, a.alert_type, a.title, a.message, a.sent_at, a.read_at, s.symbol, s.name as stock_name
         FROM alerts a
         LEFT JOIN stocks s ON a.stock_id = s.id
         WHERE a.user_id = $1
         ORDER BY a.sent_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json({ alerts: result.rows });
    } catch (error) {
      console.error('Get alerts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { alertId } = req.params;

      const result = await this.pool.query(
        'UPDATE alerts SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND read_at IS NULL',
        [alertId, userId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Alert not found or already read' });
        return;
      }

      res.json({ message: 'Alert marked as read' });
    } catch (error) {
      console.error('Mark alert as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
