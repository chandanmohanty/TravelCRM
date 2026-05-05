import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Opportunity, OpportunityStage } from '../../../core/models/crm.models';

const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: 1, name: 'WanderLust Europe Tour 2025', companyId: 1, companyName: 'WanderLust Corp', contactId: 1, contactName: 'James Carter', stage: 'Proposal', value: 45000, currency: 'USD', probability: 60, expectedCloseDate: new Date('2025-03-30'), assignedTo: 'Sarah Mitchell', tags: ['Corporate', 'Europe'], createdAt: new Date('2024-11-15'), updatedAt: new Date() },
  { id: 2, name: 'Arab VIP Luxury Package', companyId: 2, companyName: 'Arab Travel Agency', contactId: 4, contactName: 'Aisha Al-Farsi', stage: 'Negotiation', value: 250000, currency: 'USD', probability: 80, expectedCloseDate: new Date('2025-02-15'), assignedTo: 'Tom Bradley', tags: ['VIP', 'Luxury'], createdAt: new Date('2024-12-01'), updatedAt: new Date() },
  { id: 3, name: 'SinoTravel Annual Contract', companyId: 4, companyName: 'SinoTravel Group', contactId: 6, contactName: 'Chen Wei', stage: 'Qualification', value: 98000, currency: 'USD', probability: 40, expectedCloseDate: new Date('2025-04-30'), assignedTo: 'Emma Johnson', tags: ['Enterprise'], createdAt: new Date('2024-12-12'), updatedAt: new Date() },
  { id: 4, name: 'Voyageur Honeymoon Series', companyId: 3, companyName: 'Voyageur Paris', contactId: 5, contactName: 'Lucas Dupont', stage: 'Closed Won', value: 55000, currency: 'USD', probability: 100, expectedCloseDate: new Date('2024-12-20'), assignedTo: 'Emma Johnson', tags: ['Honeymoon'], createdAt: new Date('2024-11-20'), updatedAt: new Date() },
  { id: 5, name: 'Horizons Corporate Travel', companyId: 6, companyName: 'Horizons Ltd', contactId: 2, contactName: 'Priya Nair', stage: 'Prospect', value: 120000, currency: 'USD', probability: 20, expectedCloseDate: new Date('2025-06-30'), assignedTo: 'Tom Bradley', tags: ['Corporate'], createdAt: new Date('2024-12-01'), updatedAt: new Date() },
  { id: 6, name: 'Nordic Family Escapes', companyId: 5, companyName: 'Nordic Voyage', contactId: 8, contactName: 'Sophie Andersen', stage: 'Qualification', value: 35000, currency: 'USD', probability: 35, expectedCloseDate: new Date('2025-05-15'), assignedTo: 'Sarah Mitchell', tags: ['Family'], createdAt: new Date('2024-12-08'), updatedAt: new Date() },
  { id: 7, name: 'TravelBiz Group Booking', companyId: 8, companyName: 'TravelBiz Mexico', contactId: 3, contactName: 'Michael Torres', stage: 'Proposal', value: 30000, currency: 'USD', probability: 55, expectedCloseDate: new Date('2025-03-15'), assignedTo: 'Sarah Mitchell', tags: ['Group'], createdAt: new Date('2024-12-10'), updatedAt: new Date() },
  { id: 8, name: 'Afrika Safari Adventure', companyId: 7, companyName: 'Afrika Treks', contactId: 7, contactName: 'Amara Osei', stage: 'Prospect', value: 20000, currency: 'USD', probability: 15, expectedCloseDate: new Date('2025-07-01'), assignedTo: 'Tom Bradley', tags: ['Adventure'], createdAt: new Date('2024-12-18'), updatedAt: new Date() },
];

const STAGES: { key: OpportunityStage; label: string; color: string; bg: string }[] = [
  { key: 'Prospect',      label: 'Prospect',      color: '#6c757d', bg: '#f8f9fa' },
  { key: 'Qualification', label: 'Qualification', color: '#0d6efd', bg: '#cfe2ff' },
  { key: 'Proposal',      label: 'Proposal',      color: '#fd7e14', bg: '#ffe5d0' },
  { key: 'Negotiation',   label: 'Negotiation',   color: '#6f42c1', bg: '#e2d9f3' },
  { key: 'Closed Won',    label: 'Closed Won',    color: '#198754', bg: '#d1e7dd' },
  { key: 'Closed Lost',   label: 'Closed Lost',   color: '#dc3545', bg: '#f8d7da' },
];

@Component({
  selector: 'app-pipeline',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, TablerIconsModule],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Sales Pipeline</h2>
          <span class="subtitle">{{ totalDeals }} open deals · {{ totalValue | currency:'USD':'symbol':'1.0-0' }} total value</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button class="mr-2">
            <i-tabler name="adjustments-horizontal" class="icon-sm mr-1"></i-tabler> Filter
          </button>
          <button mat-flat-button color="primary">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Opportunity
          </button>
        </div>
      </div>

      <!-- Pipeline Summary -->
      <div class="pipeline-summary">
        <div class="summary-item" *ngFor="let stage of stages">
          <div class="summary-stage" [style.color]="stage.color">{{ stage.label }}</div>
          <div class="summary-value">{{ getStageValue(stage.key) | currency:'USD':'symbol':'1.0-0' }}</div>
          <div class="summary-count">{{ getStageCount(stage.key) }} deals</div>
          <div class="summary-bar" [style.background]="stage.bg">
            <div class="summary-bar-fill" [style.background]="stage.color"
              [style.width.%]="getStagePercent(stage.key)"></div>
          </div>
        </div>
      </div>

      <!-- Kanban Board -->
      <div class="kanban-board">
        <div class="kanban-column" *ngFor="let stage of stages">
          <div class="kanban-header" [style.border-top-color]="stage.color">
            <span class="stage-name" [style.color]="stage.color">{{ stage.label }}</span>
            <span class="stage-count" [style.background]="stage.bg" [style.color]="stage.color">
              {{ getStageCount(stage.key) }}
            </span>
          </div>
          <div class="kanban-cards">
            <div class="kanban-card" *ngFor="let deal of getDealsForStage(stage.key)">
              <div class="card-header">
                <div class="deal-name">{{ deal.name }}</div>
                <button mat-icon-button [matMenuTriggerFor]="menu" class="card-menu-btn">
                  <i-tabler name="dots-vertical" class="icon-xs"></i-tabler>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item><i-tabler name="eye" class="icon-xs mr-1"></i-tabler> View</button>
                  <button mat-menu-item><i-tabler name="edit" class="icon-xs mr-1"></i-tabler> Edit</button>
                  <button mat-menu-item><i-tabler name="arrow-right" class="icon-xs mr-1"></i-tabler> Move Stage</button>
                </mat-menu>
              </div>
              <div class="deal-company">
                <i-tabler name="building" class="icon-xs text-muted"></i-tabler>
                {{ deal.companyName }}
              </div>
              <div class="deal-value">{{ deal.value | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="card-footer">
                <div class="probability">
                  <div class="prob-bar">
                    <div class="prob-fill" [style.width.%]="deal.probability" [style.background]="stage.color"></div>
                  </div>
                  <span class="prob-text">{{ deal.probability }}%</span>
                </div>
                <div class="close-date">
                  <i-tabler name="calendar" class="icon-xs text-muted"></i-tabler>
                  {{ deal.expectedCloseDate | date:'MMM d' }}
                </div>
              </div>
              <div class="assigned-tag">
                <div class="avatar-xs" [style.background]="getColor(deal.assignedTo)">
                  {{ deal.assignedTo[0] }}
                </div>
                <span class="assigned-name">{{ deal.assignedTo }}</span>
              </div>
            </div>
            <button mat-button class="add-deal-btn" color="primary">
              <i-tabler name="plus" class="icon-xs mr-1"></i-tabler> Add Deal
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }

    /* Pipeline Summary */
    .pipeline-summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-item { background: white; border-radius: 8px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .summary-stage { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .summary-value { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
    .summary-count { font-size: 12px; color: #6c757d; margin-bottom: 8px; }
    .summary-bar { height: 4px; border-radius: 2px; overflow: hidden; }
    .summary-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

    /* Kanban */
    .kanban-board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 16px; min-height: 500px; }
    .kanban-column { min-width: 280px; max-width: 280px; display: flex; flex-direction: column; }
    .kanban-header { background: white; border-radius: 8px 8px 0 0; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-top: 3px solid; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .stage-name { font-weight: 600; font-size: 14px; }
    .stage-count { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .kanban-cards { display: flex; flex-direction: column; gap: 12px; padding: 12px; background: #f5f5f5; border-radius: 0 0 8px 8px; flex: 1; min-height: 400px; }

    /* Cards */
    .kanban-card { background: white; border-radius: 8px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); cursor: pointer; transition: box-shadow 0.2s; }
    .kanban-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .deal-name { font-weight: 600; font-size: 14px; line-height: 1.3; flex: 1; }
    .card-menu-btn { width: 24px; height: 24px; }
    .deal-company { font-size: 12px; color: #6c757d; display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
    .deal-value { font-size: 18px; font-weight: 700; color: #1a73e8; margin-bottom: 10px; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .probability { display: flex; align-items: center; gap: 6px; flex: 1; margin-right: 12px; }
    .prob-bar { height: 4px; flex: 1; background: #e9ecef; border-radius: 2px; overflow: hidden; }
    .prob-fill { height: 100%; border-radius: 2px; }
    .prob-text { font-size: 11px; color: #6c757d; font-weight: 600; white-space: nowrap; }
    .close-date { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #6c757d; white-space: nowrap; }
    .assigned-tag { display: flex; align-items: center; gap: 6px; }
    .avatar-xs { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: white; }
    .assigned-name { font-size: 12px; color: #6c757d; }
    .add-deal-btn { width: 100%; border: 1px dashed #d0d0d0; border-radius: 8px; }

    .text-muted { color: #6c757d; }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class PipelineComponent {
  stages = STAGES;
  opportunities = MOCK_OPPORTUNITIES;

  get totalDeals() { return this.opportunities.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost').length; }
  get totalValue() { return this.opportunities.reduce((s, o) => s + o.value, 0); }

  getDealsForStage(stage: OpportunityStage) { return this.opportunities.filter(o => o.stage === stage); }
  getStageCount(stage: OpportunityStage) { return this.getDealsForStage(stage).length; }
  getStageValue(stage: OpportunityStage) { return this.getDealsForStage(stage).reduce((s, o) => s + o.value, 0); }
  getStagePercent(stage: OpportunityStage) {
    const max = Math.max(...this.stages.map(s => this.getStageValue(s.key)));
    return max ? (this.getStageValue(stage) / max) * 100 : 0;
  }
  getColor(name: string) {
    const colors = ['#1a73e8', '#0d9488', '#7c3aed', '#ea580c', '#db2777'];
    return colors[name.charCodeAt(0) % colors.length];
  }
}
