import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  categoriesApi,
  clientsApi,
  dashboardApi,
  ordersApi,
  productsApi,
  salesApi,
  telegramApi,
  unitsApi,
  usersApi,
} from './endpoints'
import type {
  ClientUpdate,
  NamePair,
  OrderDetail,
  OrderStatus,
  OrdersQuery,
  SalesData,
  StaffUserInput,
  TelegramData,
  TelegramLink,
} from './types'

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  orders: ['orders'] as const,
  orderList: (query: OrdersQuery) => ['orders', 'list', query] as const,
  newOrdersCount: ['orders', 'new-count'] as const,
  order: (id: string | number) => ['orders', 'detail', String(id)] as const,
  clients: ['clients'] as const,
  clientList: (query: object) => ['clients', 'list', query] as const,
  client: (id: string | number) => ['clients', 'detail', String(id)] as const,
  products: ['products'] as const,
  productList: (query: object) => ['products', 'list', query] as const,
  product: (id: string | number) => ['products', 'detail', String(id)] as const,
  categories: ['categories'] as const,
  categoryList: (search: string) => ['categories', 'list', search] as const,
  units: ['units'] as const,
  users: ['users'] as const,
  userList: (query: object) => ['users', 'list', query] as const,
  user: (id: string | number) => ['users', 'detail', String(id)] as const,
  sales: ['sales'] as const,
  telegram: ['telegram'] as const,
}

export const PAGE_SIZE = 20

// ------------------------------------------------------------------ dashboard
export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: dashboardApi.get, refetchInterval: 60_000 })
}

// ------------------------------------------------------------------ orders
export function useOrders(query: OrdersQuery) {
  return useQuery({
    queryKey: queryKeys.orderList(query),
    queryFn: () => ordersApi.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}

/** Orders waiting to be processed — the badge next to "Orders" in the sidebar. */
export function useNewOrdersCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.newOrdersCount,
    queryFn: () => ordersApi.list({ status: 'ordered', page: 1, page_size: 1 }),
    select: (data) => data.count,
    refetchInterval: 60_000,
    enabled,
  })
}

export function useOrder(id: string | number) {
  return useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id) })
}

export function useUpdateOrderStatus(id: string | number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (status: OrderStatus) => ordersApi.setStatus(id, status),
    onSuccess: (order: OrderDetail) => {
      client.setQueryData(queryKeys.order(id), order)
      void client.invalidateQueries({ queryKey: queryKeys.orders, refetchType: 'none' })
      void client.invalidateQueries({ queryKey: queryKeys.dashboard })
      void client.invalidateQueries({ queryKey: queryKeys.newOrdersCount })
      if (order.client?.id) void client.invalidateQueries({ queryKey: queryKeys.client(order.client.id) })
    },
  })
}

// ------------------------------------------------------------------ clients
export function useClients(query: { search?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.clientList(query),
    queryFn: () => clientsApi.list({ ...query, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
}

export function useClient(id: string | number) {
  return useQuery({ queryKey: queryKeys.client(id), queryFn: () => clientsApi.get(id) })
}

export function useUpdateClient(id: string | number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<ClientUpdate>) => clientsApi.update(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.clients })
    },
  })
}

// ------------------------------------------------------------------ products
export function useProducts(query: { search?: string; category?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.productList(query),
    queryFn: () => productsApi.list({ ...query, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? 'new'),
    queryFn: () => productsApi.get(id as string | number),
    enabled: id !== undefined,
  })
}

function useCatalogInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.products })
    void client.invalidateQueries({ queryKey: queryKeys.categories })
    void client.invalidateQueries({ queryKey: queryKeys.sales })
    void client.invalidateQueries({ queryKey: queryKeys.dashboard })
  }
}

export function useSaveProduct(id?: string | number) {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (body: Record<string, unknown> | FormData) =>
      id === undefined ? productsApi.create(body) : productsApi.update(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteProduct() {
  const invalidate = useCatalogInvalidation()
  return useMutation({ mutationFn: (id: number) => productsApi.remove(id), onSuccess: invalidate })
}

// ------------------------------------------------------------------ categories & units
export function useCategories(search = '') {
  return useQuery({
    queryKey: queryKeys.categoryList(search),
    queryFn: () => categoriesApi.list(search || undefined),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useSaveCategory() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: NamePair }) =>
      id === undefined ? categoriesApi.create(body) : categoriesApi.update(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useCatalogInvalidation()
  return useMutation({ mutationFn: (id: number) => categoriesApi.remove(id), onSuccess: invalidate })
}

export function useUnits() {
  return useQuery({ queryKey: queryKeys.units, queryFn: unitsApi.list, staleTime: 60_000 })
}

export function useCreateUnit() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: NamePair) => unitsApi.create(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.units })
    },
  })
}

// ------------------------------------------------------------------ staff users
export function useUsers(query: { search?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.userList(query),
    queryFn: () => usersApi.list({ ...query, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
}

export function useUser(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.user(id ?? 'new'),
    queryFn: () => usersApi.get(id as string | number),
    enabled: id !== undefined,
  })
}

export function useSaveUser(id?: string | number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<StaffUserInput>) =>
      id === undefined ? usersApi.create(body as StaffUserInput) : usersApi.update(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.users })
      void client.invalidateQueries({ queryKey: queryKeys.telegram })
    },
  })
}

export function useDeleteUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.users })
      void client.invalidateQueries({ queryKey: queryKeys.telegram })
    },
  })
}

// ------------------------------------------------------------------ sales
export function useSales() {
  return useQuery({ queryKey: queryKeys.sales, queryFn: salesApi.get, staleTime: 30_000 })
}

export function useCreateSale() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: salesApi.create,
    onSuccess: (data) => {
      client.setQueryData<SalesData>(queryKeys.sales, (current) =>
        current ? { ...current, stats: data.stats, recent: [data.order, ...current.recent].slice(0, 8) } : current,
      )
      void client.invalidateQueries({ queryKey: queryKeys.orders })
      void client.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })
}

// ------------------------------------------------------------------ telegram
export function useTelegram() {
  return useQuery({ queryKey: queryKeys.telegram, queryFn: telegramApi.get })
}

export function useSetLinkNotify() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notify }: { id: number; notify: boolean }) => telegramApi.setNotify(id, notify),
    onSuccess: (link, { id, notify }) => {
      // api.md documents the updated Link in the response; the OpenAPI file says 204 — handle both.
      const update = (item: TelegramLink) => (item.id === id ? (link ?? { ...item, notify_orders: notify }) : item)
      client.setQueryData<TelegramData>(queryKeys.telegram, (current) =>
        current
          ? { ...current, my_links: current.my_links.map(update), team_links: current.team_links.map(update) }
          : current,
      )
    },
  })
}

export function useUnlink() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => telegramApi.unlink(id),
    onSuccess: (_data, id) => {
      client.setQueryData<TelegramData>(queryKeys.telegram, (current) =>
        current
          ? {
              ...current,
              my_links: current.my_links.filter((item) => item.id !== id),
              team_links: current.team_links.filter((item) => item.id !== id),
            }
          : current,
      )
      void client.invalidateQueries({ queryKey: queryKeys.telegram })
    },
  })
}
