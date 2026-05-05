import { Injectable, signal } from '@angular/core';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AccountProfile {
  name: string;
  location: string;
  email: string;
  storeName: string;
  currency: string;
  phone: string;
  address: string;
  profilePicture: string | null;   // base64 data-url or null for default
}

export interface NotificationPreferences {
  email: string;
  newsletter: boolean;
  orderConfirmation: boolean;
  orderStatusChanged: boolean;
  orderDelivered: boolean;
  emailNotification: boolean;
  ignoreBrowserTracking: boolean;
}

export interface BillingInfo {
  businessName: string;
  businessAddress: string;
  firstName: string;
  lastName: string;
  businessSector: string;
  country: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  icon: string;          // tabler icon name
  location: string;
  lastActive: string;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const PROFILE_KEY       = 'crm_account_settings';
const NOTIFICATION_KEY  = 'crm_notification_prefs';
const BILLING_KEY       = 'crm_billing_info';
const SECURITY_KEY      = 'crm_security_settings';
const DEFAULT_AVATAR    = '/assets/images/profile/user-1.jpg';

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AccountSettingsService {

  readonly profilePicture = signal<string>(DEFAULT_AVATAR);

  // ── Load ────────────────────────────────────────────────────────────────────

  loadProfile(): AccountProfile {
    const stored = this.read<AccountProfile>(PROFILE_KEY);
    if (stored) {
      this.profilePicture.set(stored.profilePicture ?? DEFAULT_AVATAR);
      return stored;
    }
    // Seed from auth user data if available
    const user = this.readAuthUser();
    const profile: AccountProfile = {
      name:           user?.fullName ?? 'Mathew Anderson',
      location:       'in',
      email:          user?.email ?? 'info@modernize.com',
      storeName:      'Maxima Studio',
      currency:       'in',
      phone:          '+91 12345 65478',
      address:        '814 Howard Street, 120065, India',
      profilePicture: null,
    };
    return profile;
  }

  loadNotifications(): NotificationPreferences {
    return this.read<NotificationPreferences>(NOTIFICATION_KEY) ?? {
      email: '',
      newsletter: false,
      orderConfirmation: false,
      orderStatusChanged: false,
      orderDelivered: false,
      emailNotification: false,
      ignoreBrowserTracking: false,
    };
  }

  loadBilling(): BillingInfo {
    return this.read<BillingInfo>(BILLING_KEY) ?? {
      businessName: 'Visitor Analytics',
      businessAddress: '',
      firstName: '',
      lastName: '',
      businessSector: 'Arts, Media & Entertainment',
      country: 'Romania',
    };
  }

  loadSecurity(): SecuritySettings {
    return this.read<SecuritySettings>(SECURITY_KEY) ?? {
      twoFactorEnabled: false,
    };
  }

  loadDevices(): DeviceInfo[] {
    return [
      { id: '1', name: 'iPhone 14',   icon: 'device-mobile', location: 'London UK, Oct 23 at 1:15 AM',      lastActive: '2024-10-23T01:15:00' },
      { id: '2', name: 'Macbook Air', icon: 'device-laptop', location: 'Gujarat India, Oct 24 at 3:15 AM',  lastActive: '2024-10-24T03:15:00' },
    ];
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  saveProfile(profile: AccountProfile): void {
    this.write(PROFILE_KEY, profile);
    this.profilePicture.set(profile.profilePicture ?? DEFAULT_AVATAR);

    // Sync name/email back to crm_user so header stays up-to-date
    const raw = localStorage.getItem('crm_user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        user.fullName = profile.name;
        user.email = profile.email;
        localStorage.setItem('crm_user', JSON.stringify(user));
      } catch { /* ignore */ }
    }
  }

  saveNotifications(prefs: NotificationPreferences): void {
    this.write(NOTIFICATION_KEY, prefs);
  }

  saveBilling(info: BillingInfo): void {
    this.write(BILLING_KEY, info);
  }

  saveSecurity(settings: SecuritySettings): void {
    this.write(SECURITY_KEY, settings);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }

  private write<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private readAuthUser(): { fullName?: string; email?: string } | null {
    try {
      const raw = localStorage.getItem('crm_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
