import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Server-side convention: every response is wrapped in
 * <code>{ success, data, meta?, error?, errors?, correlationId? }</code>.
 *
 * This interceptor hides that wrapper from feature services so they keep
 * seeing the bare <code>data</code> payload they were written against:
 *
 *   • success=true &nbsp;&nbsp;→ HttpResponse<TData>         (body = data)
 *   • success=false → throws HttpErrorResponse with { error, errors } as the error body
 *
 * Requests to non-API endpoints (the SPA's own asset URLs) pass through
 * untouched. Non-JSON responses (e.g. binary downloads) are also untouched.
 */
@Injectable()
export class EnvelopeInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only process responses to our API
    const isApi = /\/api\//.test(req.url);
    if (!isApi) return next.handle(req);

    return next.handle(req).pipe(
      map(event => {
        if (!(event instanceof HttpResponse)) return event;
        const body = event.body as EnvelopeShape<unknown> | unknown;
        if (!isEnvelope(body)) return event;

        if (body.success) {
          return event.clone({ body: body.data });
        }

        // Convert {success:false} payload into an error the standard error
        // interceptor/toastr already handles.
        throw new HttpErrorResponse({
          status: event.status || 400,
          statusText: event.statusText,
          url: event.url ?? req.url,
          error: {
            error:  body.error,
            errors: body.errors,
            correlationId: body.correlationId,
          },
        });
      }),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && isEnvelope(err.error)) {
          // Unwrap envelope on non-2xx so downstream sees { error, errors }
          const shape = err.error as EnvelopeShape<unknown>;
          return throwError(() => new HttpErrorResponse({
            status: err.status,
            statusText: err.statusText,
            url: err.url ?? req.url,
            error: {
              error:  shape.error,
              errors: shape.errors,
              correlationId: shape.correlationId,
            },
          }));
        }
        return throwError(() => err);
      }),
    );
  }
}

interface EnvelopeShape<T> {
  success:        boolean;
  data?:          T;
  meta?:          unknown;
  error?:         string;
  errors?:        Record<string, string[]>;
  correlationId?: string;
}

function isEnvelope(value: unknown): value is EnvelopeShape<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value
    && typeof (value as { success: unknown }).success === 'boolean';
}
