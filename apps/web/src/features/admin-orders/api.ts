import {
  AdminOrderDto, AdminOrderInvoiceResponseDto, AdminOrderListDto, type OrderStatus,
} from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function listOrders(status?: OrderStatus, page = 1): Promise<AdminOrderListDto> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  return apiFetch(`/admin/orders?${params.toString()}`, AdminOrderListDto);
}

export function getOrder(id: string): Promise<AdminOrderDto> {
  return apiFetch(`/admin/orders/${id}`, AdminOrderDto);
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<AdminOrderDto> {
  return apiFetch(`/admin/orders/${id}/status`, AdminOrderDto, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function createOrderInvoice(id: string): Promise<AdminOrderInvoiceResponseDto> {
  return apiFetch(`/admin/orders/${id}/invoice`, AdminOrderInvoiceResponseDto, { method: 'POST' });
}
