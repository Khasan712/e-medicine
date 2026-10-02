import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrder, getOrders } from '../api/shop'
import type { Order, OrderStatus } from '../api/types'
import { useAuth } from './auth'

export const ORDERS_POLL_MS = 20_000
export const ORDER_POLL_MS = 10_000

export const isActiveOrder = (order: Pick<Order, 'status'>) => order.status === 'ordered' || order.status === 'on_the_way'

export const ordersKey = (token: string | null) => ['orders', token] as const
export const orderKey = (token: string | null, id: number) => ['order', token, id] as const

/** The customer's latest 50 orders; refreshed every 20 s while one of them is still active. */
export function useOrders(options: { poll?: boolean } = {}) {
  const { token } = useAuth()
  return useQuery({
    queryKey: ordersKey(token),
    queryFn: async ({ signal }) => (await getOrders(token!, signal)).orders,
    enabled: Boolean(token),
    refetchInterval: (query) => (options.poll && query.state.data?.some(isActiveOrder) ? ORDERS_POLL_MS : false),
  })
}

/** One order (seeded from the list), refreshed every 10 s until it is completed or rejected. */
export function useOrder(id: number) {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: orderKey(token, id),
    queryFn: async ({ signal }) => (await getOrder(token!, id, signal)).order,
    enabled: Boolean(token) && Number.isInteger(id) && id > 0,
    initialData: () => queryClient.getQueryData<Order[]>(ordersKey(token))?.find((order) => order.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(ordersKey(token))?.dataUpdatedAt,
    refetchInterval: (query) => (query.state.data && isActiveOrder(query.state.data) ? ORDER_POLL_MS : false),
  })
}

/** Steps of the tracker: pickup orders are never "on the way". */
export function orderSteps(order: Pick<Order, 'delivery_type'>): OrderStatus[] {
  return order.delivery_type === 'pickup' ? ['ordered', 'completed'] : ['ordered', 'on_the_way', 'completed']
}

export type StepState = 'done' | 'current' | 'upcoming'

export function stepState(order: Pick<Order, 'status' | 'delivery_type'>, step: OrderStatus): StepState {
  const steps = orderSteps(order)
  const status = order.delivery_type === 'pickup' && order.status === 'on_the_way' ? 'ordered' : order.status
  const current = steps.indexOf(status)
  const index = steps.indexOf(step)
  if (current === -1) return 'upcoming'
  if (index < current || (index === current && order.status === 'completed')) return 'done'
  return index === current ? 'current' : 'upcoming'
}
