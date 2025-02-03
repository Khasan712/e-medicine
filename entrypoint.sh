#set -o errexit
#set -o pipefail
#set -o nounset

python manage.py makemigrations --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py runserver 0.0.0.0:9092
#gunicorn config.wsgi:application --bind 0.0.0.0:9092 --workers 2 --timeout 120

