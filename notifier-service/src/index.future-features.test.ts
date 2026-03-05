import { NotifierService } from './index';

describe('NotifierService future features', () => {
  const stockData = {
    symbol: 'PETR4',
    price: 33.4,
    changePercent: 4.8,
    volume: 120000,
    marketCap: 35000000000,
    timestamp: new Date().toISOString(),
  };

  let service: NotifierService;

  beforeEach(() => {
    service = new NotifierService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await service.close();
  });

  it('should send recipient with email only', async () => {
    const sendMock = jest.fn().mockResolvedValue([]);
    (service as any).messagingManager = { send: sendMock };

    await service.sendAlert({ id: 1, email: 'user@example.com', name: 'User' }, stockData as any);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [recipient] = sendMock.mock.calls[0];
    expect(recipient).toMatchObject({
      id: '1',
      name: 'User',
      email: 'user@example.com',
    });
    expect(recipient.phone).toBeUndefined();
    expect(recipient.whatsapp).toBeUndefined();
  });

  it('should include phone when available', async () => {
    const sendMock = jest.fn().mockResolvedValue([]);
    (service as any).messagingManager = { send: sendMock };

    await service.sendAlert(
      { id: 2, email: 'user@example.com', name: 'User', phone: '+5511999999999' },
      stockData as any
    );

    const [recipient] = sendMock.mock.calls[0];
    expect(recipient).toMatchObject({
      id: '2',
      email: 'user@example.com',
      phone: '+5511999999999',
    });
  });

  it('should include whatsapp when available', async () => {
    const sendMock = jest.fn().mockResolvedValue([]);
    (service as any).messagingManager = { send: sendMock };

    await service.sendAlert(
      { id: 3, email: 'user@example.com', name: 'User', whatsapp: '+5511888888888' },
      stockData as any
    );

    const [recipient] = sendMock.mock.calls[0];
    expect(recipient).toMatchObject({
      id: '3',
      email: 'user@example.com',
      whatsapp: '+5511888888888',
    });
  });
});