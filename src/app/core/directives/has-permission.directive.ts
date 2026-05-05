import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Structural directive that renders its template only when the caller holds
 * the required permission slug (or any of the supplied slugs).
 *
 * Usage:
 * <pre>
 *   &lt;button *hasPermission="'admin.users.create'"&gt;Add User&lt;/button&gt;
 *   &lt;div *hasPermission="['admin.users.update','admin.users.delete']"&gt;…&lt;/div&gt;
 * </pre>
 *
 * Reacts to {@link PermissionService} signal changes, so it refreshes when
 * login state changes without a page reload.
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly perm = inject(PermissionService);

  private required: string[] = [];
  private rendered = false;

  @Input() set hasPermission(value: string | readonly string[] | undefined | null) {
    this.required = !value
      ? []
      : Array.isArray(value)
        ? [...value]
        : [value as string];
  }

  constructor() {
    effect(() => {
      // Subscribe to permission changes
      this.perm.slugs();
      const allowed = this.required.length === 0
        ? false
        : this.perm.hasAny(this.required);
      if (allowed && !this.rendered) {
        this.vcr.createEmbeddedView(this.tpl);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.vcr.clear();
        this.rendered = false;
      }
    });
  }
}
