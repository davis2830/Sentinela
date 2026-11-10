from django.core.paginator import EmptyPage, Paginator
from rest_framework.exceptions import ValidationError

from common.responses import success_response


def page_number(request):
    try:
        number = int(request.query_params.get("page", 1))
    except (TypeError, ValueError):
        raise ValidationError({"page": "Página inválida."}) from None
    if number < 1:
        raise ValidationError({"page": "Página inválida."})
    return number


def paginate(queryset, request):
    paginator = Paginator(queryset, 25)
    try:
        page = paginator.page(page_number(request))
    except EmptyPage:
        raise ValidationError({"page": "Página fuera de rango."}) from None
    return page.object_list, {
        "page": page.number,
        "page_size": 25,
        "total": paginator.count,
        "total_pages": paginator.num_pages,
        "has_next": page.has_next(),
    }


def directory_response(data, meta=None):
    response = success_response(data)
    if meta is not None:
        response.data["meta"] = meta
    return response
