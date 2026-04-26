import {
  Component,
  Output,
  EventEmitter,
  Input,
  signal,
  inject,
  computed,
  ViewEncapsulation,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateService } from '@ngx-translate/core';
import { LocaleService } from 'src/app/core/services/locale.service';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AppSettings } from 'src/app/config';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from 'src/app/core/services/auth.service';

interface notifications {
  id: number;
  icon: string;
  color: string;
  title: string;
  time: string;
  subtitle: string;
}

interface profiledd {
  id: number;
  title: string;
  link: string;
  new?: boolean;
}

interface apps {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  link: string;
  tenantOnly?: boolean;
}

@Component({
  selector: 'app-header',
  imports: [
    CommonModule,
    RouterModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  showFiller = false;
  isCollapse  = false;

  // ── Live user data from JWT ──────────────────────────────────────────────
  currentUser = this.auth.currentUser;

  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '?';
    const parts = u.fullName.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0]?.[0] ?? '?').toUpperCase();
  });

  /** Hide tenant-scoped apps when the current user is a Platform Admin. */
  visibleApps = computed(() =>
    this.currentUser()?.isPlatformAdmin
      ? this.apps.filter((a) => !a.tenantOnly)
      : this.apps
  );

  userRoleBadge = computed(() => {
    const u = this.currentUser();
    if (!u) return { label: '', cls: '' };
    if (u.isPlatformAdmin)          return { label: 'Platform',  cls: 'text-purple'  };
    if (u.roles.includes('SuperAdmin')) return { label: 'SuperAdmin', cls: 'text-primary' };
    if (u.roles.includes('Admin'))      return { label: 'Admin',     cls: 'text-primary' };
    if (u.roles.includes('Manager'))    return { label: 'Manager',   cls: 'text-warning' };
    return { label: u.roles[0] ?? '', cls: 'text-muted' };
  });

  signOut(): void {
    this.auth.logout();
  }

  toggleCollpase() {
    this.isCollapse = !this.isCollapse;
  }

  public languages = this.locale.supportedLanguages;
  public selectedLanguage = this.locale.getSelectedLanguage();

  @Output() optionsChange = new EventEmitter<AppSettings>();

  constructor(
    private settings: CoreService,
    private vsidenav: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService
  ) {
  }

  options = this.settings.getOptions();

  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  changeLanguage(lang: any): void {
    this.locale.setLanguage(lang.code);
    this.selectedLanguage = lang;
  }

  setlightDark(theme: string) {
    this.options.theme = theme;
    this.emitOptions();
  }

  private emitOptions() {
    this.optionsChange.emit(this.options);
  }

  notifications: notifications[] = [
    {
      id: 1,
      icon: 'a-b-2',
      color: 'primary',
      time: '8:30 AM',
      title: 'Launch Admin',
      subtitle: 'Just see the my new admin!',
    },
    {
      id: 2,
      icon: 'calendar',
      color: 'secondary',
      time: '8:21 AM',
      title: 'Event today',
      subtitle: 'Just a reminder that you have event',
    },
    {
      id: 3,
      icon: 'settings',
      color: 'warning',
      time: '8:05 AM',
      title: 'Settings',
      subtitle: 'You can customize this template',
    },
    {
      id: 4,
      icon: 'a-b-2',
      color: 'success',
      time: '7:30 AM',
      title: 'Launch Templates',
      subtitle: 'Just see the my new admin!',
    },
    {
      id: 5,
      icon: 'exclamation-circle',
      color: 'error',
      time: '7:03 AM',
      title: 'Event tomorrow',
      subtitle: 'Just a reminder that you have event',
    },
  ];

  profiledd: profiledd[] = [
    { id: 1, title: 'My Profile',       link: '/theme-pages/account-setting' },
    { id: 2, title: 'My Subscription',  link: '/settings/tenant/plan' },
    { id: 3, title: 'My Invoice',       link: '/settings/tenant/billing', new: true },
    { id: 4, title: 'Account Settings', link: '/theme-pages/account-setting' },
  ];

  apps: apps[] = [
    {
      id: 0,
      icon: 'solar:checklist-minimalistic-line-duotone',
      color: 'primary',
      title: 'Task Management',
      subtitle: 'Plan, assign, track work',
      link: '/apps/task',
      tenantOnly: true,
    },
    {
      id: 1,
      icon: 'solar:chat-line-line-duotone',
      color: 'primary',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/',
    },
    {
      id: 2,
      icon: 'solar:checklist-minimalistic-line-duotone',
      color: 'secondary',
      title: 'Todo App',
      subtitle: 'Completed task',
      link: '/',
    },
    {
      id: 3,
      icon: 'solar:bill-list-line-duotone',
      color: 'success',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/',
    },
    {
      id: 4,
      icon: 'solar:calendar-line-duotone',
      color: 'error',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/',
    },
    {
      id: 5,
      icon: 'solar:smartphone-2-line-duotone',
      color: 'warning',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/',
    },
    {
      id: 6,
      icon: 'solar:ticket-line-duotone',
      color: 'primary',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/',
    },
    {
      id: 7,
      icon: 'solar:letter-line-duotone',
      color: 'secondary',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/',
    },
    {
      id: 8,
      icon: 'solar:book-2-line-duotone',
      color: 'warning',
      title: 'Contact List',
      subtitle: 'Create new contact',
      link: '/',
    },
  ];
}

@Component({
  selector: 'search-dialog',
  imports: [
    RouterModule,
    MaterialModule,
    TablerIconsModule,
    FormsModule,
    MatDividerModule,
  ],
  templateUrl: 'search-dialog.component.html',
})
export class AppSearchDialogComponent {
  searchText: string = '';
  navItems = navItems;

  navItemsData = navItems.filter((navitem) => navitem.displayName);

  // filtered = this.navItemsData.find((obj) => {
  //   return obj.displayName == this.searchinput;
  // });
}
