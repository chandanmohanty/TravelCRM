import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { menuItems } from './iconmenu-data';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatListItem, MatNavList } from '@angular/material/list';
import { NavigationEnd, Router } from '@angular/router';
import { navItems } from '../sidebar-data';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-iconmenu',
  standalone: true,
  templateUrl: './iconmenu.component.html',
  imports: [
    TablerIconsModule,
    MatListItem,
    MatNavList,
    MatButtonModule,
    MatTooltipModule,
  ],
})
export class IconMenuComponent implements OnInit, OnDestroy {
  options = this.settings.getOptions();
  menuItems = menuItems;

  private routerSub = Subscription.EMPTY;

  getFlattenedItems(items: any[]): any[] {
    let result: any[] = [];
    for (let item of items) {
      result.push(item);
      if (item.subItems) {
        result = result.concat(this.getFlattenedItems(item.subItems));
      }
    }
    return result;
  }

  findId: any;
  selectedMenu: any;

  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() openClosedMenu = new EventEmitter<void>();
  @Output() iconSelected = new EventEmitter<number>();

  constructor(private settings: CoreService, private router: Router) {}

  selectIcon(icon: number) {
    this.iconSelected.emit(icon);
    this.selectedMenu = icon;
    this.openClosedMenu.emit();
  }

  /**
   * Walk navItems (up to 3 levels) and return the id of the group that owns `url`.
   * Uses prefix matching so sub-routes (e.g. /settings/email/new)
   * correctly resolve to their parent sidebar entry (/settings/email).
   */
  findParentRouteId(routes: any[], url: string): number | null {
    for (const route of routes) {
      if (route.route && this.routeMatches(url, route.route)) return route.id ?? null;
      if (route.children) {
        for (const child of route.children) {
          if (child.route && this.routeMatches(url, child.route)) return route.id ?? null;
          // 3rd level (e.g. Manage Tenant sub-pages)
          if (child.children) {
            for (const grandchild of child.children) {
              if (grandchild.route && this.routeMatches(url, grandchild.route))
                return route.id ?? null;
            }
          }
        }
      }
    }
    return null;
  }

  /** True when the browser URL matches or is a child of the sidebar route. */
  private routeMatches(url: string, route: string): boolean {
    if (url === route) return true;
    // Segment-safe prefix match: /settings/email matches /settings/email/new
    // but NOT /settings/emailXyz
    return url.startsWith(route + '/');
  }

  private syncToUrl(url: string): void {
    // Strip query-string / fragment so matching works cleanly
    const path = url.split('?')[0].split('#')[0];
    const found = this.findParentRouteId(navItems, path);
    if (found !== null && found !== undefined) {
      this.selectedMenu = found;
      this.iconSelected.emit(found);
    }
  }

  ngOnInit(): void {
    // Sync on first load (defer one tick so parent binding is wired)
    setTimeout(() => this.syncToUrl(this.router.url), 0);

    // Sync on every subsequent navigation (SPA navigation without full reload)
    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.syncToUrl((e as NavigationEnd).urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }
}
