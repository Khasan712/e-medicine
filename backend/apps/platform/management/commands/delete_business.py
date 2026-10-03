from django.core.management.base import BaseCommand, CommandError

from apps.platform.overview import businesses
from apps.platform.provisioning import delete_business


class Command(BaseCommand):
    help = ('Deletes businesses for good: their schema (every order, customer, product), domains, bots and uploaded '
            'files. There is no undo. Our panel does the same for one suspended business.')

    def add_arguments(self, parser):
        parser.add_argument('slugs', nargs='*', help='slugs of the businesses to delete')
        parser.add_argument('--prefix', help='every business whose slug starts with this (e.g. e2e- for test runs)')
        parser.add_argument('--yes', action='store_true', help='do not ask for confirmation')

    def handle(self, *args, slugs, prefix, yes, **options):
        if not slugs and not prefix:
            raise CommandError('Give slugs or --prefix')
        targets = list(businesses().filter(slug__in=slugs)) if slugs else []
        if prefix:
            targets += [business for business in businesses().filter(slug__startswith=prefix)
                        if business not in targets]
        missing = set(slugs) - {business.slug for business in targets}
        if missing:
            raise CommandError(f'No such business: {", ".join(sorted(missing))}')
        if not targets:
            self.stdout.write('Nothing to delete')
            return
        names = ', '.join(f'{business.name} ({business.slug})' for business in targets)
        if not yes and input(f'Delete {names} with all their data? Type "yes": ').strip() != 'yes':
            raise CommandError('Cancelled')

        for business in targets:
            delete_business(business)
            self.stdout.write(self.style.SUCCESS(f'deleted {business.slug} (schema {business.schema_name})'))
