const mockSend = jest.fn();
jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actual,
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { main: queryHandler } = require('../../src/metric-query-handler');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { main: consumer } = require('../../src/metric-updates-consumer');

describe('metric-query-handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return usage data for a user query', async () => {
    mockSend.mockResolvedValue({
      Items: [
        { count: { N: '3' } },
        { count: { N: '2' } },
      ],
      Count: 2,
    });

    const result = await queryHandler({
      metricId: 'emails-sent',
      workspaceId: 'ws-1',
      userId: 'user-1',
      fromDate: '2024-01-01T00',
      toDate: '2024-01-31T23',
    });

    expect(result.count).toBe(5);
    expect(result.metricId).toBe('emails-sent');
  });
});

describe('metric-updates-consumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process a valid SQS event', async () => {
    mockSend.mockResolvedValue({});

    await consumer({
      Records: [
        {
          body: JSON.stringify({
            workspaceId: 'ws-1',
            metricId: 'emails-sent',
            count: 1,
            date: '2024-01-15T14',
          }),
          messageId: 'msg-1',
        },
      ],
    });

    // 2 writes per workspace entity: hourly (H#) and daily (D#)
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
