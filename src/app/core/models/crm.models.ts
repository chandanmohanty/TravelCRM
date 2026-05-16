// ─── Lead ────────────────────────────────────────────────────────────────────

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Unqualified' | 'Converted';
export type LeadSource = 'Website' | 'Referral' | 'Social Media' | 'Email Campaign' | 'Trade Show' | 'Cold Call' | 'Partner' | 'Other';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: LeadStatus;
  source: LeadSource;
  score: number;           // 0–100
  assignedTo: string;
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedValue?: number;
}

// ─── Contact ─────────────────────────────────────────────────────────────────

export type ContactType = 'Client' | 'Prospect' | 'Partner' | 'Supplier' | 'Agent';

export interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile?: string;
  jobTitle: string;
  department?: string;
  companyId: number;
  companyName: string;
  type: ContactType;
  avatarUrl?: string;
  address?: Address;
  tags: string[];
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Company / Account ───────────────────────────────────────────────────────

export type CompanyIndustry =
  | 'Travel & Tourism'
  | 'Hospitality'
  | 'Aviation'
  | 'Corporate Travel'
  | 'Leisure Travel'
  | 'Technology'
  | 'Finance'
  | 'Healthcare'
  | 'Education'
  | 'Retail'
  | 'Other';

export interface Company {
  id: number;
  name: string;
  industry: CompanyIndustry;
  website?: string;
  phone: string;
  email: string;
  address?: Address;
  annualRevenue?: number;
  employeeCount?: number;
  openDeals: number;
  totalContacts: number;
  assignedTo: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Opportunity / Deal ──────────────────────────────────────────────────────

/**
 * @deprecated Use `PipelineStageKind` from Phase 1 types below.
 * Retained until Task 26 removes the old /crm/pipeline stub.
 */
export type OpportunityStage =
  | 'Prospect'
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

/**
 * @deprecated Use `DealDto` from Phase 1 types below.
 * Retained until Task 26 removes the old /crm/pipeline stub.
 */
export interface Opportunity {
  id: number;
  name: string;
  companyId: number;
  companyName: string;
  contactId: number;
  contactName: string;
  stage: OpportunityStage;
  value: number;
  currency: string;
  probability: number;     // 0–100
  expectedCloseDate: Date;
  assignedTo: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Phase 1: Deals & Pipelines ───────────────────────────────────────────────

export type PipelineStageKind = 'Open' | 'Won' | 'Lost';
export type DealStatus        = 'Open' | 'Won' | 'Lost';

export interface PipelineStageDto {
  id: string;
  pipelineId: string;
  name: string;
  sortOrder: number;
  defaultProbability: number;
  kind: PipelineStageKind;
  colorHex: string;
  isActive: boolean;
  dealCount: number;
}

export interface PipelineDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  dealCount: number;
  stages: PipelineStageDto[];
}

export interface DealActivityDto {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string | null;
  kind: 'Created' | 'StageChanged' | 'OwnerChanged' | 'ValueChanged'
      | 'Closed' | 'Reopened' | 'Note';
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
}

export interface DealDto {
  id: string;
  title: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  stageKind: PipelineStageKind;
  stageColor: string;
  leadId: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  companyName: string | null;
  value: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  ownerUserId: string;
  ownerName: string | null;
  tags: string[];
  notes: string | null;
  status: DealStatus;
  rowVersion: string;
  createdAt: string;
  updatedAt: string | null;
  recentActivity: DealActivityDto[] | null;
}

export interface KanbanColumnDto {
  stageId: string;
  stageName: string;
  stageKind: PipelineStageKind;
  stageColor: string;
  sortOrder: number;
  probability: number;
  deals: DealDto[];
  totalCount: number;
  totalValue: number | null;
  totalValueByCurrency: Record<string, number>;
}

export interface KanbanDto {
  pipelineId: string;
  pipelineName: string;
  columns: KanbanColumnDto[];
}

// ─── Quotation ───────────────────────────────────────────────────────────────

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface QuotationLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface Quotation {
  id: number;
  number: string;         // e.g. QUO-2024-0042
  opportunityId?: number;
  companyId: number;
  companyName: string;
  contactId: number;
  contactName: string;
  status: QuotationStatus;
  lineItems: QuotationLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  validUntil: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Travel Package ──────────────────────────────────────────────────────────

export type PackageCategory = 'Adventure' | 'Beach' | 'Cultural' | 'Honeymoon' | 'Family' | 'Business' | 'Luxury' | 'Budget';

export interface TravelPackage {
  id: number;
  name: string;
  destinationId: number;
  destinationName: string;
  category: PackageCategory;
  durationDays: number;
  durationNights: number;
  pricePerPerson: number;
  currency: string;
  maxGroupSize: number;
  availableSlots: number;
  rating: number;          // 1–5
  reviewCount: number;
  imageUrl?: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  supplierId: number;
  supplierName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Destination ─────────────────────────────────────────────────────────────

export interface Destination {
  id: number;
  name: string;
  country: string;
  region: string;
  continent: string;
  description: string;
  imageUrl?: string;
  popularityScore: number;
  activePackages: number;
  averageRating: number;
  bestTimeToVisit: string;
  currency: string;
  language: string;
  visaRequired: boolean;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
}

// ─── Booking ─────────────────────────────────────────────────────────────────

export type BookingStatus = 'Pending' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled' | 'Refunded';
export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Refunded';

export interface Booking {
  id: number;
  bookingNumber: string;   // e.g. BK-2024-00123
  customerId: number;
  customerName: string;
  packageId: number;
  packageName: string;
  destinationId: number;
  destinationName: string;
  travelStartDate: Date;
  travelEndDate: Date;
  numberOfTravellers: number;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  assignedAgent: string;
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Customer ────────────────────────────────────────────────────────────────

export type CustomerTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  nationality: string;
  passportNumber?: string;
  tier: CustomerTier;
  loyaltyPoints: number;
  totalBookings: number;
  totalSpent: number;
  currency: string;
  preferredDestinations: string[];
  preferredPackageTypes: PackageCategory[];
  address?: Address;
  avatarUrl?: string;
  tags: string[];
  lastBookingDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export type CampaignType = 'Email' | 'SMS' | 'Social Media' | 'Newsletter' | 'Paid Ads';
export type CampaignStatus = 'Draft' | 'Scheduled' | 'Active' | 'Paused' | 'Completed' | 'Cancelled';

export interface Campaign {
  id: number;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  targetSegment: string;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  conversionCount: number;
  budget: number;
  spent: number;
  currency: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Supplier ────────────────────────────────────────────────────────────────

export type SupplierType = 'Hotel' | 'Airline' | 'Car Rental' | 'Tour Operator' | 'Cruise Line' | 'Activity Provider' | 'Insurance' | 'Other';

export interface Supplier {
  id: number;
  name: string;
  type: SupplierType;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  address?: Address;
  country: string;
  commissionRate: number;  // percentage
  activePackages: number;
  totalBookings: number;
  rating: number;
  contractExpiry?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

// NOTE: the app-wide pagination envelope is `PaginatedResponse<T>` in
// `core/models/identity.model.ts` — it mirrors the backend
// Common.PaginatedResponse<T> ({ items, page, pageSize, totalCount, totalPages }).
// A duplicate previously lived here with a WRONG shape ({ data, total }) and was
// imported by nobody; removed to keep a single source of truth. Import from
// identity.model.ts when a paginated CRM endpoint needs it.

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface DashboardKpi {
  label: string;
  value: number | string;
  change: number;          // percentage change
  changeDirection: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}
