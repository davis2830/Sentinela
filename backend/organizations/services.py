from django.db import transaction

from .models import Organization


class OrganizationService:
    """Service for organization management.

    Handles CRUD operations and configuration for tenants.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_organizations():
        """Return all organizations ordered by creation date."""
        return Organization.objects.all().order_by("-created_at")

    @staticmethod
    def get_organization(organization_id):
        """Return a single organization by ID.

        Raises:
            Organization.DoesNotExist if not found.
        """
        return Organization.objects.get(id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_organization(name, slug, timezone="UTC", locale="en-US"):
        """Create a new organization.

        Args:
            name: Organization display name.
            slug: URL-friendly unique identifier.
            timezone: Timezone string (default UTC).
            locale: Locale string (default en-US).

        Returns:
            The created Organization instance.
        """
        return Organization.objects.create(
            name=name,
            slug=slug,
            timezone=timezone,
            locale=locale,
        )

    @staticmethod
    @transaction.atomic
    def update_organization(organization_id, **fields):
        """Update an existing organization.

        Args:
            organization_id: UUID of the organization.
            **fields: Fields to update (name, slug, status, timezone, locale).

        Returns:
            The updated Organization instance.
        """
        organization = Organization.objects.get(id=organization_id)
        for field, value in fields.items():
            if value is not None:
                setattr(organization, field, value)
        organization.save()
        return organization

    @staticmethod
    @transaction.atomic
    def delete_organization(organization_id):
        """Delete an organization.

        Args:
            organization_id: UUID of the organization to delete.
        """
        organization = Organization.objects.get(id=organization_id)
        organization.delete()