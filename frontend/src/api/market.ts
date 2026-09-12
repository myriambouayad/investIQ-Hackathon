import api from './client';
import type { QuotesResponse } from '../types';

export async function getQuotes(): Promise<QuotesResponse> {
  const res = await api.get<QuotesResponse>('/market/quotes');
  return res.data;
}
