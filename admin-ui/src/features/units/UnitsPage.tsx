import { useState } from 'react'
import { useCreateUnit, useUnits } from '../../api/queries'
import type { Unit } from '../../api/types'
import { NamePairModal } from '../../components/NamePairModal'
import { useToast } from '../../components/feedback/feedback'
import { IconPlus, IconScale } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'

export function UnitsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useUnits()
  const create = useCreateUnit()
  const [open, setOpen] = useState(false)

  const columns: Array<Column<Unit>> = [
    {
      key: 'uz',
      header: t('name_uz'),
      skeleton: 'w-32',
      cell: (unit) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
            <IconScale size={18} />
          </span>
          <span className="font-semibold text-fg">{unit.name_uz || '—'}</span>
        </div>
      ),
    },
    {
      key: 'ru',
      header: t('name_ru'),
      skeleton: 'w-32',
      cell: (unit) => <span className="text-fg-soft">{unit.name_ru || '—'}</span>,
    },
    {
      key: 'id',
      header: t('id'),
      align: 'right',
      skeleton: 'w-10',
      cell: (unit) => <span className="text-muted tabular">#{unit.id}</span>,
    },
  ]

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t('units_title')}
        description={t('units_subtitle')}
        actions={
          <Button icon={<IconPlus size={18} />} onClick={() => setOpen(true)}>
            {t('add_unit')}
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <DataTable
          caption={t('units_title')}
          columns={columns}
          rows={data}
          rowKey={(unit) => unit.id}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          skeletonRows={4}
          empty={
            <EmptyState
              icon={<IconScale size={26} />}
              title={t('no_units')}
              description={t('units_example')}
              action={
                <Button size="sm" icon={<IconPlus size={16} />} onClick={() => setOpen(true)}>
                  {t('add_unit')}
                </Button>
              }
            />
          }
        />
      </Card>
      <NamePairModal
        open={open}
        onClose={() => setOpen(false)}
        title={t('create_unit')}
        description={t('units_example')}
        submitLabel={t('create')}
        placeholderUz="dona"
        placeholderRu="шт"
        icon={
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
            <IconScale size={22} />
          </span>
        }
        onSubmit={async (body) => {
          await create.mutateAsync(body)
          toast.success(t('unit_created'))
        }}
      />
    </div>
  )
}
