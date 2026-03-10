import { wsService } from '../src/lib/websocket-service';

describe('WebSocketService', () => {
  it('starts disconnected by default', () => {
    expect(wsService.isConnected()).toBe(false);
  });

  it('allows subscribing and unsubscribing handlers', () => {
    const handler = jest.fn();
    const unsubscribe = wsService.subscribe('task_created', handler);

    wsService['notifyHandlers']({
      type: 'task_created',
      payload: { id: '123' },
      timestamp: new Date().toISOString(),
    });

    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    // Call again, handler should no longer be invoked
    wsService['notifyHandlers']({
      type: 'task_created',
      payload: { id: '123' },
      timestamp: new Date().toISOString(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

