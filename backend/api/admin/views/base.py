from rest_framework import generics
from rest_framework.views import APIView

from ...common.auth import SessionAuthentication
from ...common.permissions import IsBusinessAdmin, IsStaff


class StaffView(APIView):
    """An endpoint for any signed-in staff member of the business (admin or manager)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaff]


class StaffListView(generics.ListAPIView):
    """A paginated list for staff; subclasses filter in get_queryset()."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaff]


class AdminView(StaffView):
    permission_classes = [IsBusinessAdmin]


class AdminListView(StaffListView):
    permission_classes = [IsBusinessAdmin]


def search_term(request):
    return request.query_params.get('search', '').strip()
