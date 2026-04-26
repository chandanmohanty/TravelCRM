export type SupplierType = 'Hotel' | 'Transport' | 'Activity' | 'Guide' | 'Other';

export interface SupplierDto {
  id: string;
  name: string;
  supplierType: SupplierType;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  contractValidFrom?: string | null;   // ISO date (DateOnly serialised)
  contractValidTo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierWriteBody {
  name: string;
  supplierType: SupplierType;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  contractValidFrom?: string | null;
  contractValidTo?: string | null;
}

export interface SupplierUpdateBody extends SupplierWriteBody {
  isActive: boolean;
}
