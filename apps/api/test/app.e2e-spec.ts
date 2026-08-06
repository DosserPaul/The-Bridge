import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  ActivityDetail,
  ActivityListResult,
} from './../src/activity/activity.types';
import { DatabaseService } from './../src/database/database.service';
import { GitHubClientService } from './../src/integrations/github-client.service';
import { KeychainCredentialService } from './../src/integrations/keychain-credential.service';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    await database.initialize();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(database)
      .overrideProvider(GitHubClientService)
      .useValue({
        validateConnection: jest.fn().mockResolvedValue({
          id: '84',
          username: 'pauldosser',
          name: 'Paul Dosser',
          avatarUrl: 'https://avatars.githubusercontent.com/u/84',
        }),
      })
      .overrideProvider(KeychainCredentialService)
      .useValue({
        store: jest.fn().mockResolvedValue(undefined),
        read: jest.fn().mockResolvedValue('github_pat_stored'),
        remove: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/integrations/gitlab (GET)', () => {
    return request(app.getHttpServer())
      .get('/integrations/gitlab')
      .expect(200)
      .expect([]);
  });

  it('/integrations/github (POST, GET, DELETE) connects without logging its token', async () => {
    const created = await request(app.getHttpServer())
      .post('/integrations/github')
      .send({ token: 'github_pat_never_log_this' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          provider: 'github',
          baseUrl: 'https://github.com',
          account: {
            id: '84',
            username: 'pauldosser',
            name: 'Paul Dosser',
          },
          credentialState: 'available',
        });
        expect(body).not.toHaveProperty('token');
      });
    const createdBody = created.body as { id: string };

    const listed = await request(app.getHttpServer())
      .get('/integrations/github')
      .expect(200);
    const listedBody = listed.body as Array<{ id: string; provider: string }>;
    expect(listedBody).toHaveLength(1);
    expect(listedBody[0]).toMatchObject({
      id: createdBody.id,
      provider: 'github',
    });

    const activityList = await request(app.getHttpServer())
      .get('/activity?search=integration.github.connected')
      .expect(200);
    const activityListBody = activityList.body as ActivityListResult;
    expect(activityListBody.total).toBe(1);

    const detail = await request(app.getHttpServer())
      .get(`/activity/${activityListBody.items[0].id}`)
      .expect(200);
    const detailBody = detail.body as ActivityDetail;
    expect(detailBody.request).toMatchObject({
      body: { token: '[REDACTED]' },
    });

    await request(app.getHttpServer())
      .delete(`/integrations/github/${createdBody.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/integrations/github')
      .expect(200)
      .expect([]);
  });

  it('/clients (GET)', () => {
    return request(app.getHttpServer()).get('/clients').expect(200).expect([]);
  });

  it('/clients/:clientId (PATCH) updates the client and its logo', async () => {
    const created = await request(app.getHttpServer())
      .post('/clients')
      .send({
        name: 'Defim',
        kind: 'organization',
        status: 'prospect',
      })
      .expect(201);
    const createdBody = created.body as { id: string };

    await request(app.getHttpServer())
      .patch(`/clients/${createdBody.id}`)
      .send({
        status: 'active',
        logoDataUrl: 'data:image/png;base64,aGVsbG8=',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'Defim',
          status: 'active',
          logoDataUrl: 'data:image/png;base64,aGVsbG8=',
        });
      });
  });

  it('/activity (GET) lists actions without logging its own reads', async () => {
    await request(app.getHttpServer())
      .post('/clients')
      .send({
        name: 'Juris Global',
        kind: 'organization',
        status: 'active',
      })
      .expect(201);

    const firstRead = await request(app.getHttpServer())
      .get('/activity?category=clients')
      .expect(200);
    const firstReadBody = firstRead.body as ActivityListResult;

    expect(firstReadBody).toMatchObject({
      total: 1,
      counts: { success: 1, error: 0 },
      items: [
        expect.objectContaining({
          category: 'clients',
          action: 'client.created',
          status: 'success',
        }),
      ],
    });

    const secondRead = await request(app.getHttpServer())
      .get('/activity?category=clients')
      .expect(200);
    const secondReadBody = secondRead.body as ActivityListResult;
    expect(secondReadBody.total).toBe(1);
  });

  it('/activity (GET) records failed actions with their error details', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${randomUUID()}`)
      .expect(404);

    const activityList = await request(app.getHttpServer())
      .get('/activity?status=error')
      .expect(200);
    const activityListBody = activityList.body as ActivityListResult;
    expect(activityListBody).toMatchObject({
      total: 1,
      counts: { success: 0, error: 1 },
      items: [
        expect.objectContaining({
          action: 'client.viewed',
          status: 'error',
          httpStatus: 404,
        }),
      ],
    });

    const detail = await request(app.getHttpServer())
      .get(`/activity/${activityListBody.items[0].id}`)
      .expect(200);
    const detailBody = detail.body as ActivityDetail;
    expect(detailBody.error).toMatchObject({
      message: 'Client introuvable.',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
