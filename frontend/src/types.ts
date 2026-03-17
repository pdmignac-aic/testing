export interface Manufacturer {
  id: number;
  batch_id: string;
  company_name: string;
  address: string;
  website: string;
  city: string;
  county: string;
  state: string;
  zip_code: string;
  status: 'pending' | 'processing' | 'complete' | 'partial' | 'failed';
  edc_name: string | null;
  edc_contact_name: string | null;
  edc_contact_email: string | null;
  edc_contact_phone: string | null;
  edc_website: string | null;
  edc_source: string | null;
  major_customers: string | null;
  customer_source: string | null;
  trade_associations: string | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchInfo {
  batch_id: string;
  total: number;
  preview: Record<string, string>[];
}

export interface Progress {
  batch_id: string;
  total: number;
  completed: number;
  processing: number;
  failed: number;
  partial: number;
  pending: number;
  status: 'running' | 'complete' | 'idle';
  errors: { id: number; company: string; error: string }[];
}

export interface ManufacturerPage {
  data: Manufacturer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
