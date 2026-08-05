import { DatabaseService } from '../database/database.service';
import { ActivityService, serializeActivityPayload } from './activity.service';

describe('ActivityService', () => {
  let database: DatabaseService;
  let activity: ActivityService;

  beforeEach(() => {
    database = new DatabaseService(':memory:');
    activity = new ActivityService(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('redacts secrets and replaces image data with metadata', () => {
    const serialized = serializeActivityPayload({
      token: 'glpat-secret',
      nested: { password: 'secret-password' },
      logoDataUrl: 'data:image/png;base64,aGVsbG8=',
    });

    expect(JSON.parse(serialized ?? '{}')).toEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]' },
      logoDataUrl: {
        type: 'image',
        mimeType: 'image/png',
        approximateBytes: 6,
        omitted: true,
      },
    });
  });

  it('records and retrieves full event details', () => {
    activity.record({
      requestId: 'request-1',
      category: 'clients',
      action: 'client.updated',
      status: 'success',
      method: 'PATCH',
      route: '/api/clients/client-1',
      subjectType: 'client',
      subjectId: 'client-1',
      subjectLabel: 'Juris Global',
      request: { body: { status: 'active' } },
      response: { id: 'client-1', name: 'Juris Global' },
      httpStatus: 200,
      durationMs: 12.4,
    });

    const result = activity.list({ limit: 50, category: 'clients' });

    expect(result).toMatchObject({
      total: 1,
      counts: { success: 1, error: 0 },
      items: [
        expect.objectContaining({
          action: 'client.updated',
          summary: 'Client modifié · Juris Global',
          durationMs: 12,
        }),
      ],
    });
    expect(activity.findOne(result.items[0].id)).toMatchObject({
      request: { body: { status: 'active' } },
      response: { id: 'client-1', name: 'Juris Global' },
      error: null,
    });
  });

  it('filters events and paginates with an opaque cursor', () => {
    for (const [index, category] of [
      'clients',
      'projects',
      'clients',
    ].entries()) {
      activity.record({
        requestId: `request-${index}`,
        category: category as 'clients' | 'projects',
        action: `${category}.viewed`,
        status: index === 2 ? 'error' : 'success',
        method: 'GET',
        route: `/api/${category}`,
        httpStatus: index === 2 ? 500 : 200,
        durationMs: index,
      });
    }

    const firstPage = activity.list({ limit: 1, category: 'clients' });
    const secondPage = activity.list({
      limit: 1,
      category: 'clients',
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(firstPage.total).toBe(2);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
  });
});
