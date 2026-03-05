/**
 * Tests for Assets Controller
 */
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { AssetsController } from '../controllers/assets.controller';

describe('AssetsController', () => {
  let assetsController: AssetsController;
  let mockPool: jest.Mocked<Pool>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as unknown as jest.Mocked<Pool>;

    assetsController = new AssetsController(mockPool);

    mockRequest = {
      query: {},
      params: {},
      body: {},
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getAssets', () => {
    it('should return only active assets by default', async () => {
      const mockAssets = [
        { id: 1, symbol: 'PETR4', name: 'Petrobras PN', asset_type: 'stock', active: true },
        { id: 2, symbol: 'VALE3', name: 'Vale ON', asset_type: 'stock', active: true },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockAssets });

      await assetsController.getAssets(mockRequest as Request, mockResponse as Response);

      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[0]).toContain('WHERE active = TRUE');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        assets: mockAssets,
      });
    });

    it('should return all assets when active=false', async () => {
      mockRequest.query = { active: 'false' };
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await assetsController.getAssets(mockRequest as Request, mockResponse as Response);

      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[0]).not.toContain('WHERE active = TRUE');
    });

    it('should handle database errors gracefully', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await assetsController.getAssets(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch tracked assets',
      });
    });
  });

  describe('addAsset', () => {
    it('should add a new asset and return 201', async () => {
      mockRequest.body = { symbol: 'aapl', name: 'Apple Inc.', asset_type: 'stock' };

      const insertedAsset = {
        id: 5,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        asset_type: 'stock',
        active: true,
      };
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [insertedAsset] });

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        asset: insertedAsset,
      });

      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][0]).toBe('AAPL');
    });

    it('should return 400 when symbol is missing', async () => {
      mockRequest.body = { name: 'No Symbol Asset' };

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'symbol is required',
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should return 400 when symbol is empty string', async () => {
      mockRequest.body = { symbol: '   ' };

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when symbol contains invalid characters', async () => {
      mockRequest.body = { symbol: 'INVALID/SYM' };

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'symbol contains invalid characters',
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should use symbol as name when name is not provided', async () => {
      mockRequest.body = { symbol: 'TSLA' };
      const insertedAsset = { id: 6, symbol: 'TSLA', name: 'TSLA', asset_type: 'stock', active: true };
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [insertedAsset] });

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][1]).toBe('TSLA');
    });

    it('should default asset_type to stock when not provided', async () => {
      mockRequest.body = { symbol: 'NVDA', name: 'Nvidia' };
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 7, symbol: 'NVDA', name: 'Nvidia', asset_type: 'stock', active: true }],
      });

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][2]).toBe('stock');
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.body = { symbol: 'ERR1' };
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await assetsController.addAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to add tracked asset',
      });
    });
  });

  describe('removeAsset', () => {
    it('should deactivate an asset successfully', async () => {
      mockRequest.params = { symbol: 'PETR4' };
      (mockPool.query as jest.Mock).mockResolvedValue({ rowCount: 1, rows: [{ id: 1, symbol: 'PETR4' }] });

      await assetsController.removeAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Asset PETR4 deactivated',
      });
    });

    it('should return 404 when asset does not exist', async () => {
      mockRequest.params = { symbol: 'UNKNOWN' };
      (mockPool.query as jest.Mock).mockResolvedValue({ rowCount: 0, rows: [] });

      await assetsController.removeAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Asset not found',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.params = { symbol: 'PETR4' };
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await assetsController.removeAsset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to remove tracked asset',
      });
    });
  });
});
