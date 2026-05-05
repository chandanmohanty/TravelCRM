import {
  Component, ChangeDetectionStrategy, OnInit, signal, inject, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  AccountSettingsService, AccountProfile, NotificationPreferences, BillingInfo, DeviceInfo
} from '../../../core/services/account-settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

// ── Password match validator ─────────────────────────────────────────────────

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPw    = control.get('newPassword')?.value;
  const confirm  = control.get('confirmPassword')?.value;
  if (!newPw || !confirm) return null;
  return newPw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-account-setting',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatIconModule, TablerIconsModule, MatTabsModule,
    MatFormFieldModule, MatSlideToggleModule, MatSelectModule,
    MatInputModule, MatButtonModule, MatDividerModule,
    MatMenuModule, MatDialogModule, MatSnackBarModule,
  ],
  templateUrl: './account-setting.component.html',
})
export class AppAccountSettingComponent implements OnInit {
  private fb       = inject(FormBuilder);
  private snack    = inject(MatSnackBar);
  private dialog   = inject(MatDialog);
  private settings = inject(AccountSettingsService);
  private auth     = inject(AuthService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ── Signals ─────────────────────────────────────────────────────────────────
  profilePictureUrl = this.settings.profilePicture;
  twoFactorEnabled  = signal(false);
  devices           = signal<DeviceInfo[]>([]);
  activeTabIndex    = signal(0);

  // ── Forms ───────────────────────────────────────────────────────────────────
  profileForm = this.fb.group({
    name:      ['', Validators.required],
    location:  ['in'],
    email:     ['', [Validators.required, Validators.email]],
    storeName: [''],
    currency:  ['in'],
    phone:     [''],
    address:   [''],
  });

  passwordForm = this.fb.group({
    currentPassword:  ['', Validators.required],
    newPassword:      ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword:  ['', Validators.required],
  }, { validators: passwordMatchValidator });

  notificationForm = this.fb.group({
    email:                ['', Validators.email],
    newsletter:           [false],
    orderConfirmation:    [false],
    orderStatusChanged:   [false],
    orderDelivered:       [false],
    emailNotification:    [false],
    ignoreBrowserTracking:[false],
  });

  billingForm = this.fb.group({
    businessName:    ['', Validators.required],
    businessAddress: [''],
    firstName:       [''],
    lastName:        [''],
    businessSector:  [''],
    country:         [''],
  });

  // Snapshot for cancel/reset
  private _profileSnapshot!: AccountProfile;
  private _notifSnapshot!:   NotificationPreferences;
  private _billingSnapshot!: BillingInfo;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const profile = this.settings.loadProfile();
    this._profileSnapshot = { ...profile };
    this.profileForm.patchValue(profile);

    const notif = this.settings.loadNotifications();
    this._notifSnapshot = { ...notif };
    this.notificationForm.patchValue(notif);

    const billing = this.settings.loadBilling();
    this._billingSnapshot = { ...billing };
    this.billingForm.patchValue(billing);

    const security = this.settings.loadSecurity();
    this.twoFactorEnabled.set(security.twoFactorEnabled);

    this.devices.set(this.settings.loadDevices());
  }

  // ── Tab ─────────────────────────────────────────────────────────────────────

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  // ── Profile Picture ─────────────────────────────────────────────────────────

  onUploadClick(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.snack.open('Only JPG, PNG, or GIF files are allowed', 'OK', { duration: 3000 });
      return;
    }
    if (file.size > 800 * 1024) {
      this.snack.open('File size must be under 800KB', 'OK', { duration: 3000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.settings.profilePicture.set(reader.result as string);
      this.snack.open('Profile picture updated', 'OK', { duration: 2000 });
    };
    reader.readAsDataURL(file);
    input.value = '';  // Allow re-selecting same file
  }

  onResetPicture(): void {
    this.settings.profilePicture.set('/assets/images/profile/user-1.jpg');
    this.snack.open('Profile picture reset to default', 'OK', { duration: 2000 });
  }

  // ── Password ────────────────────────────────────────────────────────────────

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    // No backend — simply accept the change
    this.passwordForm.reset();
    this.snack.open('Password changed successfully', 'OK', { duration: 3000 });
  }

  // ── Save / Cancel ───────────────────────────────────────────────────────────

  onSave(): void {
    switch (this.activeTabIndex()) {
      case 0: {
        if (this.profileForm.invalid) {
          this.profileForm.markAllAsTouched();
          this.snack.open('Please fix validation errors', 'OK', { duration: 3000 });
          return;
        }
        const profile: AccountProfile = {
          ...this.profileForm.getRawValue() as any,
          profilePicture: this.profilePictureUrl() === '/assets/images/profile/user-1.jpg'
            ? null : this.profilePictureUrl(),
        };
        this.settings.saveProfile(profile);
        this._profileSnapshot = { ...profile };
        this.snack.open('Profile saved successfully', 'OK', { duration: 3000 });
        break;
      }
      case 1: {
        const notif = this.notificationForm.getRawValue() as NotificationPreferences;
        this.settings.saveNotifications(notif);
        this._notifSnapshot = { ...notif };
        this.snack.open('Notification preferences saved', 'OK', { duration: 3000 });
        break;
      }
      case 2: {
        if (this.billingForm.invalid) {
          this.billingForm.markAllAsTouched();
          this.snack.open('Please fix validation errors', 'OK', { duration: 3000 });
          return;
        }
        const billing = this.billingForm.getRawValue() as BillingInfo;
        this.settings.saveBilling(billing);
        this._billingSnapshot = { ...billing };
        this.snack.open('Billing information saved', 'OK', { duration: 3000 });
        break;
      }
      case 3: {
        this.settings.saveSecurity({ twoFactorEnabled: this.twoFactorEnabled() });
        this.snack.open('Security settings saved', 'OK', { duration: 3000 });
        break;
      }
    }
  }

  onCancel(): void {
    switch (this.activeTabIndex()) {
      case 0:
        this.profileForm.patchValue(this._profileSnapshot);
        if (this._profileSnapshot.profilePicture) {
          this.settings.profilePicture.set(this._profileSnapshot.profilePicture);
        } else {
          this.settings.profilePicture.set('/assets/images/profile/user-1.jpg');
        }
        break;
      case 1:
        this.notificationForm.patchValue(this._notifSnapshot);
        break;
      case 2:
        this.billingForm.patchValue(this._billingSnapshot);
        break;
    }
    this.snack.open('Changes discarded', 'OK', { duration: 2000 });
  }

  // ── Bills ───────────────────────────────────────────────────────────────────

  onChangePlan(): void {
    this.snack.open('Plan management coming soon', 'OK', { duration: 3000 });
  }

  onResetPlan(): void {
    this.snack.open('Plan has been reset to default', 'OK', { duration: 3000 });
  }

  onCancelSubscription(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Cancel Subscription',
        message: 'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of the billing period.',
        confirmText: 'Cancel Subscription',
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.snack.open('Subscription cancelled', 'OK', { duration: 3000 });
      }
    });
  }

  // ── Security ────────────────────────────────────────────────────────────────

  onToggle2FA(): void {
    const enabling = !this.twoFactorEnabled();
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: enabling ? 'Enable Two-Factor Authentication' : 'Disable Two-Factor Authentication',
        message: enabling
          ? 'This will add an extra layer of security to your account. You will need an authenticator app to sign in.'
          : 'Disabling 2FA will make your account less secure. Are you sure?',
        confirmText: enabling ? 'Enable' : 'Disable',
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.twoFactorEnabled.set(enabling);
        this.settings.saveSecurity({ twoFactorEnabled: enabling });
        this.snack.open(
          enabling ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
          'OK', { duration: 3000 },
        );
      }
    });
  }

  onSetup2FA(method: string): void {
    this.snack.open(`${method} setup coming soon`, 'OK', { duration: 3000 });
  }

  onSignOutAllDevices(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Sign Out All Devices',
        message: 'This will sign you out from all devices including this one. You will need to log in again.',
        confirmText: 'Sign Out All',
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.auth.logout();
      }
    });
  }

  onDeviceSignOut(device: DeviceInfo): void {
    this.devices.update(list => list.filter(d => d.id !== device.id));
    this.snack.open(`Signed out from ${device.name}`, 'OK', { duration: 3000 });
  }

  onNeedHelp(): void {
    this.snack.open('Support contact: help@travelcrm.io', 'OK', { duration: 5000 });
  }
}
