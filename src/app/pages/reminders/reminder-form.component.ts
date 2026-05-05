import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatRadioModule } from '@angular/material/radio';
import {
  ReminderChannel,
  ReminderStatus,
  ReminderTriggerType,
  ReminderWriteBody,
  RemindersService,
} from '../../core/services/reminders.service';

@Component({
  selector: 'app-reminder-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatSnackBarModule, MatDividerModule, MatRadioModule,
  ],
  template: `
    <div class="page-header m-b-24 d-flex align-items-center gap-8">
      <a mat-icon-button routerLink="/reminders"><mat-icon>arrow_back</mat-icon></a>
      <h2 class="f-s-24 f-w-700 m-0">{{ isNew() ? 'New Reminder' : 'Edit Reminder' }}</h2>
    </div>

    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Reminder Details</mat-card-title>
          <div class="row">
            <div class="col-md-8 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" placeholder="Daily Lead Follow-up" />
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="Active">Active</mat-option>
                  <mat-option value="Paused">Paused</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-12 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Message Template</mat-label>
                <textarea matInput formControlName="messageTemplate" rows="3"
                          placeholder="Hello, just a reminder about your upcoming trip…"></textarea>
                <mat-hint>Supports token placeholders (e.g. name, date) for future dynamic data.</mat-hint>
              </mat-form-field>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Trigger</mat-card-title>
          <div class="row">
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Trigger Type</mat-label>
                <mat-select formControlName="triggerType">
                  <mat-option value="TimeBased">Time-Based (Cron / One-shot)</mat-option>
                  <mat-option value="EventTriggered">Event-Triggered</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Channel</mat-label>
                <mat-select formControlName="channel">
                  <mat-option value="WhatsApp">WhatsApp</mat-option>
                  <mat-option value="Email">Email</mat-option>
                  <mat-option value="Both">Both (WhatsApp + Email)</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            @if (form.value.triggerType === 'TimeBased') {
              <div class="col-md-6 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Cron Expression (for recurring)</mat-label>
                  <input matInput formControlName="cronExpression" placeholder="0 9 * * *" />
                  <mat-hint>Standard cron: min hr dom mon dow. E.g. "0 9 * * *" = daily at 9am.</mat-hint>
                </mat-form-field>
              </div>
              <div class="col-md-6 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Scheduled At (for one-shot)</mat-label>
                  <input matInput type="datetime-local" formControlName="scheduledAt" />
                  <mat-hint>Leave blank if using a cron expression.</mat-hint>
                </mat-form-field>
              </div>
            }

            @if (form.value.triggerType === 'EventTriggered') {
              <div class="col-md-6 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Event Name</mat-label>
                  <input matInput formControlName="eventName" placeholder="lead.status_changed" />
                  <mat-hint>The domain event that triggers this reminder.</mat-hint>
                </mat-form-field>
              </div>
              <div class="col-md-6 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Delay (minutes)</mat-label>
                  <input matInput type="number" min="0" formControlName="delayMinutes" />
                  <mat-hint>0 = send immediately when event fires.</mat-hint>
                </mat-form-field>
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Recipient</mat-card-title>
          <div class="row">
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Recipient Name</mat-label>
                <input matInput formControlName="recipientName" placeholder="John Doe" />
              </mat-form-field>
            </div>
            @if (needsPhone()) {
              <div class="col-md-4 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Phone Number (E.164)</mat-label>
                  <input matInput formControlName="recipientPhone" placeholder="+919876543210" />
                </mat-form-field>
              </div>
            }
            @if (needsEmail()) {
              <div class="col-md-4 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Email Address</mat-label>
                  <input matInput type="email" formControlName="recipientEmail" placeholder="contact@example.com" />
                </mat-form-field>
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-divider class="m-b-16"></mat-divider>
          <div class="d-flex justify-content-end gap-8">
            <a mat-stroked-button routerLink="/reminders">Cancel</a>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon> {{ saving() ? 'Saving…' : (isNew() ? 'Create' : 'Save Changes') }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </form>
  `,
})
export class ReminderFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(RemindersService);
  private readonly snack  = inject(MatSnackBar);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly isNew  = signal(true);

  form = this.fb.group({
    title:           ['', [Validators.required, Validators.maxLength(200)]],
    messageTemplate: ['', [Validators.required, Validators.maxLength(2000)]],
    triggerType:     ['TimeBased' as ReminderTriggerType, Validators.required],
    channel:         ['WhatsApp' as ReminderChannel, Validators.required],
    status:          ['Active' as ReminderStatus, Validators.required],
    cronExpression:  [null as string | null],
    scheduledAt:     [null as string | null],
    eventName:       [null as string | null],
    delayMinutes:    [null as number | null],
    recipientPhone:  [null as string | null],
    recipientEmail:  [null as string | null],
    recipientName:   [null as string | null],
  });

  needsPhone(): boolean {
    const ch = this.form.value.channel;
    return ch === 'WhatsApp' || ch === 'Both';
  }

  needsEmail(): boolean {
    const ch = this.form.value.channel;
    return ch === 'Email' || ch === 'Both';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.api.get(id).subscribe({
        next: r => {
          this.form.patchValue({
            title: r.title, messageTemplate: r.messageTemplate,
            triggerType: r.triggerType, channel: r.channel, status: r.status,
            cronExpression: r.cronExpression,
            scheduledAt: r.scheduledAt ? r.scheduledAt.slice(0, 16) : null,
            eventName: r.eventName, delayMinutes: r.delayMinutes,
            recipientPhone: r.recipientPhone, recipientEmail: r.recipientEmail,
            recipientName: r.recipientName,
          });
        },
        error: err => {
          this.snack.open(err?.error?.error ?? 'Failed to load reminder.', 'Close', { duration: 3500 });
          this.router.navigate(['/reminders']);
        },
      });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: ReminderWriteBody = {
      title: v.title!, messageTemplate: v.messageTemplate!,
      triggerType: v.triggerType!, channel: v.channel!, status: v.status!,
      cronExpression: v.cronExpression || null,
      scheduledAt: v.scheduledAt ? new Date(v.scheduledAt).toISOString() : null,
      eventName: v.eventName || null,
      delayMinutes: v.delayMinutes ?? null,
      recipientPhone: v.recipientPhone || null,
      recipientEmail: v.recipientEmail || null,
      recipientName: v.recipientName || null,
    };

    const id = this.route.snapshot.paramMap.get('id');
    const call$ = (id && id !== 'new')
      ? this.api.update(id, body)
      : this.api.create(body);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Reminder saved.', 'Close', { duration: 2500 });
        this.router.navigate(['/reminders']);
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }
}
