"""One allowlisted transport registry shared by delivery and diagnostics."""

from dataclasses import dataclass
from typing import Protocol

from .models import Notification, NotificationChannel


class Transport(Protocol):
    @staticmethod
    def send(channel: NotificationChannel, notification: Notification) -> tuple[str, int | None, int]: ...


@dataclass(frozen=True)
class DeliveryResult:
    response: str
    status: int | None
    duration_ms: int


def transport_registry() -> dict[str, type[Transport]]:
    # Delayed import keeps handlers' validators and secrets at their existing boundary.
    from .services import (
        EmailDeliveryHandler,
        SlackDeliveryHandler,
        TeamsDeliveryHandler,
        DiscordDeliveryHandler,
        TelegramDeliveryHandler,
        WebhookDeliveryHandler,
    )

    return {
        "email": EmailDeliveryHandler,
        "slack": SlackDeliveryHandler,
        "teams": TeamsDeliveryHandler,
        "discord": DiscordDeliveryHandler,
        "telegram": TelegramDeliveryHandler,
        "webhook": WebhookDeliveryHandler,
    }


def deliver(channel: NotificationChannel, notification: Notification) -> DeliveryResult:
    handler = transport_registry().get(channel.channel_type)
    if handler is None:
        raise ValueError("Tipo de canal no soportado.")
    response, status, duration = handler.send(channel, notification)
    return DeliveryResult(response, status, duration)
