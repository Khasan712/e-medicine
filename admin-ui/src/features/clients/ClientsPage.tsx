import { Link } from 'react-router'
import { PAGE_SIZE, useClients } from '../../api/queries'
import type { ClientSummary } from '../../api/types'
import { IconClients, IconPencil, IconTelegram } from '../../components/icons'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { SearchInput } from '../../components/ui/Form'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { EmptyState } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { formatDate, formatFullDateTime, formatPhone, fullName } from '../../lib/format'
import { useFirstPageOnMissing, useListParams } from '../../lib/useListParams'

const FILTERS = ['search'] as const

export function ClientLangBadge({ lang }: { lang: string }) {
  if (lang !== 'uz' && lang !== 'ru') return <span className="text-faint">—</span>
  return (
    <Badge tone={lang === 'uz' ? 'green' : 'blue'} size="xs">
      {lang.toUpperCase()}
    </Badge>
  )
}

export function ClientsPage() {
  const { t, tn, lang } = useI18n()
  const { values, page, setFilter, setPage } = useListParams(FILTERS)
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useClients({ search: values.search, page })
  useFirstPageOnMissing(error, page, setPage)

  const columns: Array<Column<ClientSummary>> = [
    {
      key: 'client',
      header: t('client'),
      skeleton: 'w-44',
      cell: (client) => (
        <div className="flex items-center gap-3">
          <Avatar name={client.first_name || client.phone || '?'} secondary={client.last_name} />
          <div className="min-w-0">
            <Link to={`/clients/${client.id}`} className="block max-w-56 truncate font-semibold text-fg hover:text-primary-600 dark:hover:text-primary-400">
              {fullName(client.first_name, client.last_name) || '—'}
            </Link>
            <p className="text-xs text-muted tabular">ID: {client.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('phone'),
      skeleton: 'w-28',
      cell: (client) => <span className="whitespace-nowrap text-fg-soft tabular">{formatPhone(client.phone) || '—'}</span>,
    },
    {
      key: 'telegram',
      header: t('telegram'),
      hideBelow: 'lg',
      skeleton: 'w-24',
      cell: (client) =>
        client.tg_nick ? (
          <span className="inline-flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
            <IconTelegram size={14} className="-rotate-12" />@{client.tg_nick}
          </span>
        ) : client.telegram ? (
          <Badge tone="sky" size="xs">
            {t('telegram_linked')}
          </Badge>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: 'lang',
      header: t('language'),
      hideBelow: 'xl',
      skeleton: 'w-10',
      cell: (client) => <ClientLangBadge lang={client.lang} />,
    },
    {
      key: 'orders',
      header: t('nav_orders'),
      skeleton: 'w-16',
      cell: (client) => (
        <Badge tone={client.orders_count ? 'violet' : 'gray'} size="sm">
          {tn('orders', client.orders_count)}
        </Badge>
      ),
    },
    {
      key: 'joined',
      header: t('joined'),
      hideBelow: 'md',
      skeleton: 'w-24',
      cell: (client) => (
        <time dateTime={client.created_at} title={formatFullDateTime(client.created_at, lang)} className="whitespace-nowrap text-muted">
          {formatDate(client.created_at, lang)}
        </time>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      align: 'right',
      skeleton: 'w-16',
      cell: (client) => (
        <ButtonLink
          to={`/clients/${client.id}/edit`}
          variant="ghost"
          size="sm"
          icon={<IconPencil size={15} />}
          aria-label={`${t('edit')}: ${fullName(client.first_name, client.last_name) || client.id}`}
        >
          <span className="hidden xl:inline">{t('edit')}</span>
        </ButtonLink>
      ),
    },
  ]

  return (
    <>
      <PageHeader title={t('clients_title')} description={data ? tn('clients', data.count) : t('clients_subtitle')} />
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <SearchInput
            className="max-w-xl"
            value={values.search}
            onSearch={(value) => setFilter('search', value)}
            placeholder={t('search_clients')}
            loading={isFetching && isPlaceholderData}
          />
        </div>
        <DataTable
          caption={t('clients_title')}
          columns={columns}
          rows={data?.results}
          rowKey={(client) => client.id}
          rowHref={(client) => `/clients/${client.id}`}
          loading={isLoading}
          fetching={isFetching && isPlaceholderData}
          error={error}
          onRetry={() => void refetch()}
          empty={<EmptyState icon={<IconClients size={26} />} title={t('no_clients')} />}
          mobileCard={(client) => (
            <Link to={`/clients/${client.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-subtle">
              <Avatar name={client.first_name || client.phone || '?'} secondary={client.last_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{fullName(client.first_name, client.last_name) || '—'}</p>
                <p className="truncate text-[13px] text-muted tabular">
                  {[formatPhone(client.phone), client.tg_nick && `@${client.tg_nick}`].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <Badge tone={client.orders_count ? 'violet' : 'gray'} size="xs">
                {tn('orders', client.orders_count)}
              </Badge>
            </Link>
          )}
          footer={
            data && (
              <Pagination page={data.page} pages={data.pages} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} />
            )
          }
        />
      </Card>
    </>
  )
}
