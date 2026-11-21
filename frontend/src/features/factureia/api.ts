import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Invoice, InvoiceInput, Tariffs } from './types'

const keys = { list: ['invoices'] as const, tariffs: ['invoices', 'tariffs'] as const }

export function useInvoices() {
  return useQuery({ queryKey: keys.list, queryFn: async () => (await api.get<Invoice[]>('/invoice')).data })
}

export function useTariffs() {
  return useQuery({ queryKey: keys.tariffs, queryFn: async () => (await api.get<Tariffs>('/invoice/tariffs')).data, staleTime: Infinity })
}

export function useAnalyzeInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return (await api.post<Invoice>('/invoice/analyze', form, { timeout: 30_000 })).data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  })
}

export function useSaveInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: InvoiceInput & { id?: string }) =>
      id ? (await api.patch<Invoice>(`/invoice/${id}`, input)).data : (await api.post<Invoice>('/invoice', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/invoice/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  })
}
