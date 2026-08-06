from django.db import transaction

from .models import AuditLog


class AuditService:
    """Service for audit log management.

    Audit logs are immutable — this service only supports
    creating and listing entries. No updates or deletes.
    """

    @staticmethod
    def list_logs(
        organization_id=None,
        action=None,
        module=None,
        user_id=None,
        limit=100,
    ):
        """Return audit logs with optional filters.

        Args:
            organization_id: Optional organization filter.
            action: Optional action filter.
            module: Optional module filter.
            user_id: Optional user filter.
            limit: Maximum number of entries (default 100).

        Returns:
            QuerySet of AuditLog instances.
        """
        qs = AuditLog.objects.all()

        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        if action:
            qs = qs.filter(action=action)
        if module:
            qs = qs.filter(module=module)
        if user_id:
            qs = qs.filter(user_id=user_id)

        return qs.order_by("-timestamp")[:limit]

    @staticmethod
    @transaction.atomic
    def log(
        action,
        module,
        organization_id=None,
        user_id=None,
        user_email="",
        result="success",
        ip_address=None,
        description="",
        metadata=None,
    ):
        """Create an immutable audit log entry.

        This is the single entry point for all audit logging.
        Once created, the entry cannot be modified or deleted.

        Args:
            action: Action type (login, create, update, delete, etc.).
            module: Module name (accounts, organizations, monitoring, etc.).
            organization_id: UUID of the organization (optional).
            user_id: UUID of the user who performed the action (optional).
            user_email: Email of the user for readability.
            result: Result of the action (success, failure).
            ip_address: IP address of the requester.
            description: Human-readable description of the action.
            metadata: Optional dict with additional context.

        Returns:
            The created AuditLog instance.
        """
        return AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user_id,
            user_email=user_email,
            action=action,
            module=module,
            result=result,
            ip_address=ip_address,
            description=description,
            metadata=metadata or {},
        )

    @staticmethod
    def log_from_request(request, action, module, description="", metadata=None):
        """Create an audit log entry from a Django request.

        Convenience method that extracts user info and IP from
        the request object.

        Args:
            request: Django HTTP request.
            action: Action type.
            module: Module name.
            description: Human-readable description.
            metadata: Optional dict with additional context.

        Returns:
            The created AuditLog instance.
        """
        user = getattr(request, "user", None)
        user_id = getattr(user, "id", None) if user and user.is_authenticated else None
        user_email = getattr(user, "email", "") if user and user.is_authenticated else ""
        organization_id = (
            getattr(user, "organization_id", None)
            if user and user.is_authenticated
            else None
        )

        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")

        return AuditService.log(
            action=action,
            module=module,
            organization_id=organization_id,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip,
            description=description,
            metadata=metadata,
        )