import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { TablerIconsModule } from 'angular-tabler-icons';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexChart, ApexNonAxisChartSeries, ApexAxisChartSeries,
  ApexXAxis, ApexDataLabels, ApexStroke, ApexFill, ApexTooltip,
  ApexPlotOptions, ApexLegend, ApexResponsive, ApexYAxis,
} from 'ng-apexcharts';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatTabsModule, MatMenuModule,
    MatCardModule, TablerIconsModule, NgApexchartsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Reports & Analytics</h2>
          <span class="subtitle">Business intelligence for TravelCRM Plus</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button [matMenuTriggerFor]="periodMenu" class="mr-2">
            <i-tabler name="calendar" class="icon-sm mr-1"></i-tabler> Last 12 Months
            <i-tabler name="chevron-down" class="icon-xs ml-1"></i-tabler>
          </button>
          <mat-menu #periodMenu="matMenu">
            <button mat-menu-item>Last 7 Days</button>
            <button mat-menu-item>Last 30 Days</button>
            <button mat-menu-item>Last 3 Months</button>
            <button mat-menu-item>Last 12 Months</button>
            <button mat-menu-item>Custom Range</button>
          </mat-menu>
          <button mat-flat-button color="primary">
            <i-tabler name="download" class="icon-sm mr-1"></i-tabler> Export Report
          </button>
        </div>
      </div>

      <!-- Top KPI Summary -->
      <div class="kpi-grid-6">
        <mat-card class="kpi-card" *ngFor="let kpi of summaryKpis">
          <mat-card-content>
            <div class="kpi-top">
              <div class="kpi-icon" [style.background]="kpi.bg">
                <i-tabler [name]="kpi.icon" [style.color]="kpi.color" class="icon-sm"></i-tabler>
              </div>
              <div class="kpi-change" [ngClass]="kpi.up ? 'up' : 'down'">
                <i-tabler [name]="kpi.up ? 'arrow-up' : 'arrow-down'" class="icon-xs"></i-tabler>
                {{ kpi.change }}
              </div>
            </div>
            <div class="kpi-val">{{ kpi.value }}</div>
            <div class="kpi-lbl">{{ kpi.label }}</div>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-tab-group class="report-tabs" animationDuration="200ms">

        <!-- Sales Overview Tab -->
        <mat-tab label="Sales Overview">
          <div class="tab-content">
            <div class="chart-row-2">
              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Monthly Revenue</mat-card-title>
                  <mat-card-subtitle>Actual vs Target</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <apx-chart
                    [series]="revenueChart.series"
                    [chart]="revenueChart.chart"
                    [xaxis]="revenueChart.xaxis"
                    [stroke]="revenueChart.stroke"
                    [dataLabels]="revenueChart.dataLabels"
                    [fill]="revenueChart.fill"
                    [tooltip]="revenueChart.tooltip"
                    [legend]="revenueChart.legend">
                  </apx-chart>
                </mat-card-content>
              </mat-card>
              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Revenue by Category</mat-card-title>
                  <mat-card-subtitle>Package category breakdown</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <apx-chart
                    [series]="categoryChart.series"
                    [chart]="categoryChart.chart"
                    [labels]="categoryChart.labels"
                    [legend]="categoryChart.legend"
                    [dataLabels]="categoryChart.dataLabels"
                    [responsive]="categoryChart.responsive">
                  </apx-chart>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Bookings Tab -->
        <mat-tab label="Bookings">
          <div class="tab-content">
            <div class="chart-row-2">
              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Monthly Bookings</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <apx-chart
                    [series]="bookingsChart.series"
                    [chart]="bookingsChart.chart"
                    [xaxis]="bookingsChart.xaxis"
                    [plotOptions]="bookingsChart.plotOptions"
                    [dataLabels]="bookingsChart.dataLabels"
                    [fill]="bookingsChart.fill">
                  </apx-chart>
                </mat-card-content>
              </mat-card>
              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Booking Status</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <apx-chart
                    [series]="statusChart.series"
                    [chart]="statusChart.chart"
                    [labels]="statusChart.labels"
                    [legend]="statusChart.legend"
                    [dataLabels]="statusChart.dataLabels">
                  </apx-chart>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Destinations Tab -->
        <mat-tab label="Destinations">
          <div class="tab-content">
            <mat-card>
              <mat-card-header><mat-card-title>Top Destinations by Revenue</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="dest-table">
                  <div class="dest-row header-row">
                    <span>Destination</span><span>Bookings</span><span>Revenue</span><span>Growth</span>
                  </div>
                  <div class="dest-row" *ngFor="let d of topDestinations; let i = index">
                    <span class="dest-name">
                      <span class="rank">{{ i + 1 }}</span>
                      <i-tabler name="map-pin" class="icon-xs text-primary mr-1"></i-tabler>
                      {{ d.name }}
                    </span>
                    <span>{{ d.bookings }}</span>
                    <span><strong>{{ d.revenue | currency:'USD':'symbol':'1.0-0' }}</strong></span>
                    <span [ngClass]="d.growth > 0 ? 'text-success' : 'text-error'">
                      <i-tabler [name]="d.growth > 0 ? 'trending-up' : 'trending-down'" class="icon-xs"></i-tabler>
                      {{ d.growth > 0 ? '+' : '' }}{{ d.growth }}%
                    </span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Sales Team Tab -->
        <mat-tab label="Sales Team">
          <div class="tab-content">
            <div class="team-grid">
              <mat-card class="agent-card" *ngFor="let agent of agentPerformance">
                <mat-card-content>
                  <div class="agent-header">
                    <div class="agent-avatar" [style.background]="getColor(agent.name)">{{ agent.name[0] }}</div>
                    <div>
                      <strong>{{ agent.name }}</strong>
                      <div class="sub-text">{{ agent.title }}</div>
                    </div>
                  </div>
                  <div class="agent-stats">
                    <div class="stat"><span class="stat-val">{{ agent.bookings }}</span><span class="stat-lbl">Bookings</span></div>
                    <div class="stat"><span class="stat-val">{{ agent.revenue | currency:'USD':'symbol':'1.0-0' }}</span><span class="stat-lbl">Revenue</span></div>
                    <div class="stat"><span class="stat-val">{{ agent.leads }}</span><span class="stat-lbl">Leads</span></div>
                    <div class="stat"><span class="stat-val">{{ agent.conversion }}%</span><span class="stat-lbl">Conversion</span></div>
                  </div>
                  <div class="agent-progress-label">
                    Target Attainment: <strong>{{ agent.attainment }}%</strong>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" [style.width.%]="agent.attainment"
                      [style.background]="agent.attainment >= 100 ? '#16a34a' : agent.attainment >= 75 ? '#1a73e8' : '#ea580c'"></div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; align-items: center; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }
    .ml-1 { margin-left: 4px; }

    .kpi-grid-6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 24px; }
    .kpi-card mat-card-content { padding: 14px; }
    .kpi-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .kpi-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .kpi-change { font-size: 12px; display: flex; align-items: center; gap: 2px; font-weight: 600; }
    .up { color: #16a34a; }
    .down { color: #dc3545; }
    .kpi-val { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .kpi-lbl { font-size: 12px; color: #6c757d; }

    .report-tabs { margin-top: 0; }
    .tab-content { padding: 20px 0; }
    .chart-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .chart-card mat-card-header { padding: 16px 16px 0; }
    .chart-card mat-card-content { padding: 8px; }

    .dest-table { width: 100%; }
    .dest-row { display: grid; grid-template-columns: 2fr 1fr 1.5fr 1fr; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; align-items: center; }
    .header-row { font-weight: 600; font-size: 13px; color: #6c757d; background: #fafafa; }
    .dest-name { display: flex; align-items: center; gap: 6px; }
    .rank { width: 22px; height: 22px; border-radius: 50%; background: #e8f0fe; color: #1a73e8; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
    .text-primary { color: #1a73e8; }
    .text-success { color: #16a34a; display: flex; align-items: center; gap: 3px; }
    .text-error { color: #dc3545; display: flex; align-items: center; gap: 3px; }

    .team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .agent-card mat-card-content { padding: 20px; }
    .agent-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .agent-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .agent-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat-val { font-weight: 700; font-size: 15px; }
    .stat-lbl { font-size: 11px; color: #6c757d; }
    .agent-progress-label { font-size: 12px; color: #6c757d; margin-bottom: 6px; }
    .progress-bar-bg { height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    @media (max-width: 1024px) { .kpi-grid-6 { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px) { .chart-row-2 { grid-template-columns: 1fr; } .team-grid { grid-template-columns: 1fr; } }
  `],
})
export class ReportsComponent {
  summaryKpis = [
    { label: 'Total Revenue', value: '$2.84M', change: '22%', up: true, icon: 'currency-dollar', color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Total Bookings', value: '1,284', change: '18%', up: true, icon: 'calendar-check', color: '#16a34a', bg: '#dcfce7' },
    { label: 'Avg. Booking Value', value: '$2,213', change: '8%', up: true, icon: 'chart-bar', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Leads Generated', value: '842', change: '12%', up: true, icon: 'users', color: '#0d9488', bg: '#ccfbf1' },
    { label: 'Conversion Rate', value: '34.2%', change: '2.1%', up: true, icon: 'trending-up', color: '#ea580c', bg: '#ffedd5' },
    { label: 'Customer NPS', value: '72', change: '5 pts', up: true, icon: 'star', color: '#b45309', bg: '#fef3c7' },
  ];

  revenueChart = {
    series: [
      { name: 'Actual', data: [185000, 210000, 195000, 225000, 248000, 232000, 268000, 291000, 275000, 312000, 298000, 341000] },
      { name: 'Target', data: [200000, 200000, 220000, 220000, 240000, 240000, 260000, 280000, 280000, 300000, 300000, 320000] },
    ] as ApexAxisChartSeries,
    chart: { type: 'area', height: 280, toolbar: { show: false } } as ApexChart,
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] } as ApexXAxis,
    stroke: { curve: 'smooth', width: 2 } as ApexStroke,
    dataLabels: { enabled: false } as ApexDataLabels,
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } } as ApexFill,
    tooltip: { y: { formatter: (val: number) => '$' + val.toLocaleString() } } as ApexTooltip,
    legend: { position: 'top' } as ApexLegend,
  };

  categoryChart = {
    series: [38, 24, 16, 11, 7, 4] as ApexNonAxisChartSeries,
    chart: { type: 'donut', height: 280, toolbar: { show: false } } as ApexChart,
    labels: ['Luxury', 'Adventure', 'Cultural', 'Family', 'Honeymoon', 'Other'],
    dataLabels: { enabled: true } as ApexDataLabels,
    legend: { position: 'bottom' } as ApexLegend,
    responsive: [{ breakpoint: 480, options: { chart: { width: 200 } } }] as ApexResponsive[],
  };

  bookingsChart = {
    series: [{ name: 'Bookings', data: [82, 94, 88, 107, 118, 98, 124, 138, 112, 145, 131, 147] }] as ApexAxisChartSeries,
    chart: { type: 'bar', height: 280, toolbar: { show: false } } as ApexChart,
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] } as ApexXAxis,
    plotOptions: { bar: { borderRadius: 4 } } as ApexPlotOptions,
    dataLabels: { enabled: false } as ApexDataLabels,
    fill: { colors: ['#1a73e8'] } as ApexFill,
  };

  statusChart = {
    series: [42, 31, 14, 8, 5] as ApexNonAxisChartSeries,
    chart: { type: 'pie', height: 280, toolbar: { show: false } } as ApexChart,
    labels: ['Confirmed', 'Completed', 'Pending', 'Cancelled', 'Refunded'],
    dataLabels: { enabled: true } as ApexDataLabels,
    legend: { position: 'bottom' } as ApexLegend,
  };

  topDestinations = [
    { name: 'Maldives', bookings: 187, revenue: 845000, growth: 28 },
    { name: 'Paris, France', bookings: 241, revenue: 712000, growth: 14 },
    { name: 'Bali, Indonesia', bookings: 312, revenue: 624000, growth: 22 },
    { name: 'Santorini, Greece', bookings: 128, revenue: 582000, growth: 18 },
    { name: 'Tanzania', bookings: 94, revenue: 478000, growth: 35 },
    { name: 'Tokyo, Japan', bookings: 156, revenue: 421000, growth: 12 },
    { name: 'Norway', bookings: 87, revenue: 318000, growth: 9 },
    { name: 'Cancún, Mexico', bookings: 218, revenue: 291000, growth: -3 },
  ];

  agentPerformance = [
    { name: 'Sarah Mitchell', title: 'Senior Travel Consultant', bookings: 142, revenue: 892000, leads: 218, conversion: 38, attainment: 112 },
    { name: 'Tom Bradley', title: 'Travel Consultant', bookings: 118, revenue: 724000, leads: 184, conversion: 32, attainment: 90 },
    { name: 'Emma Johnson', title: 'Travel Consultant', bookings: 127, revenue: 815000, leads: 196, conversion: 35, attainment: 102 },
    { name: 'David Okafor', title: 'Junior Consultant', bookings: 84, revenue: 412000, leads: 162, conversion: 28, attainment: 74 },
    { name: 'Li Mei Chen', title: 'Senior Travel Consultant', bookings: 153, revenue: 948000, leads: 231, conversion: 41, attainment: 118 },
    { name: 'Fatima Al-Rashid', title: 'Travel Consultant', bookings: 96, revenue: 631000, leads: 148, conversion: 30, attainment: 84 },
  ];

  getColor(name: string) {
    const c = ['#1a73e8', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#16a34a'];
    return c[name.charCodeAt(0) % c.length];
  }
}
