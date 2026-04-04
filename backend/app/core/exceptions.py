class ExternalServiceError(RuntimeError):
    """Raised when an external dependency fails in a non-recoverable way."""


class ValidationServiceError(ValueError):
    """Raised for user-facing validation errors from integration services."""
