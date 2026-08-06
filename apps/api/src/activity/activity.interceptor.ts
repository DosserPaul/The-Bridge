import { randomUUID } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { from, type Observable, throwError } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import {
  ACTIVITY_ACTION_KEY,
  SKIP_ACTIVITY_KEY,
  type ActivityActionMetadata,
} from './activity.decorator';
import { ActivityService } from './activity.service';
import type { ActivityCategory } from './activity.types';

function categoryFromRoute(route: string): ActivityCategory {
  const segments = route.split('?')[0].split('/').filter(Boolean);
  const root = segments[0] === 'api' ? segments[1] : segments[0];
  if (root === 'clients') return 'clients';
  if (root === 'projects') return 'projects';
  if (root === 'repositories') return 'repositories';
  if (root === 'integrations') return 'integrations';
  if (root === 'security') return 'security';
  return 'system';
}

function fallbackAction(method: string, route: string): string {
  const category = categoryFromRoute(route);
  const verb =
    method === 'POST'
      ? 'created'
      : method === 'PATCH' || method === 'PUT'
        ? 'updated'
        : method === 'DELETE'
          ? 'deleted'
          : 'viewed';
  return `${category}.${verb}`;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function responseLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name === 'string') return record.name;
  if (typeof record.title === 'string') return record.title;
  if (
    record.account &&
    typeof record.account === 'object' &&
    typeof (record.account as Record<string, unknown>).name === 'string'
  ) {
    return (record.account as Record<string, unknown>).name as string;
  }
  return null;
}

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activity: ActivityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_ACTIVITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (shouldSkip || request.headers['x-activity-silent'] === 'true') {
      return next.handle();
    }

    const metadata = this.reflector.getAllAndOverride<ActivityActionMetadata>(
      ACTIVITY_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const startedAt = performance.now();
    const route = request.originalUrl.split('?')[0];
    const method = request.method.toUpperCase();
    const requestId =
      headerValue(request.headers['x-request-id']) ?? randomUUID();
    response.setHeader('x-request-id', requestId);

    const common = {
      requestId,
      category: metadata?.category ?? categoryFromRoute(route),
      action: metadata?.action ?? fallbackAction(method, route),
      method,
      route,
      subjectType: metadata?.subjectType,
      subjectId: metadata?.subjectParam
        ? headerValue(request.params[metadata.subjectParam])
        : null,
      request: {
        params: request.params,
        query: request.query,
        body: request.body as unknown,
      },
    };

    return next.handle().pipe(
      mergeMap((body: unknown) => {
        const bodyRecord =
          body && typeof body === 'object' && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : null;
        return from(
          this.activity.record({
            ...common,
            status: 'success',
            subjectId:
              common.subjectId ??
              (typeof bodyRecord?.id === 'string' ? bodyRecord.id : null),
            subjectLabel: responseLabel(body),
            response: body,
            httpStatus: response.statusCode,
            durationMs: performance.now() - startedAt,
          }),
        ).pipe(map(() => body));
      }),
      catchError((error: unknown) => {
        const status =
          error instanceof HttpException
            ? error.getStatus()
            : typeof error === 'object' &&
                error !== null &&
                'status' in error &&
                typeof error.status === 'number'
              ? error.status
              : 500;
        return from(
          this.activity.record({
            ...common,
            status: 'error',
            error:
              error instanceof HttpException
                ? {
                    name: error.name,
                    message: error.message,
                    response: error.getResponse(),
                    stack: error.stack,
                  }
                : error,
            httpStatus: status,
            durationMs: performance.now() - startedAt,
          }),
        ).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }
}
