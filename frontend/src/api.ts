import axios from 'axios';
import type { BatchInfo, Progress, ManufacturerPage } from './types';

const api = axios.create({ baseURL: '/api' });

export async function uploadCSV(file: File): Promise<BatchInfo> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<BatchInfo>('/upload', form);
  return data;
}

export async function startEnrichment(batchId: string, maxConcurrent?: number) {
  const { data } = await api.post('/enrich', {
    batch_id: batchId,
    max_concurrent: maxConcurrent,
  });
  return data;
}

export async function enrichSingle(manufacturerId: number) {
  const { data } = await api.post(`/enrich/${manufacturerId}`);
  return data;
}

export async function getProgress(batchId: string): Promise<Progress> {
  const { data } = await api.get<Progress>(`/progress/${batchId}`);
  return data;
}

export async function getManufacturers(
  batchId: string,
  params: {
    search?: string;
    sort_by?: string;
    sort_dir?: string;
    page?: number;
    page_size?: number;
  }
): Promise<ManufacturerPage> {
  const { data } = await api.get<ManufacturerPage>(`/manufacturers/${batchId}`, { params });
  return data;
}

export function getExportUrl(batchId: string): string {
  return `/api/export/${batchId}`;
}
