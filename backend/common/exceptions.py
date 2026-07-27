class SentinelError(Exception):
    """Base exception for all Sentinel domain errors."""

    default_message = "An unexpected error occurred."

    def __init__(self, message=None, errors=None):
        self.message = message or self.default_message
        self.errors = errors or []
        super().__init__(self.message)


class OrganizationNotFoundError(SentinelError):
    default_message = "Organization not found."


class PermissionDeniedError(SentinelError):
    default_message = "You do not have permission to perform this action."


class ValidationError(SentinelError):
    default_message = "Validation error."


class NotFoundError(SentinelError):
    default_message = "Resource not found."