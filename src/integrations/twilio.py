"""Twilio integration for SMS and voice communications.

Provides appointment reminders, voice AI, and SMS communications
for the healthcare platform.
"""

from datetime import datetime
from functools import lru_cache
from typing import Any, Literal

import structlog

logger = structlog.get_logger()


# Configuration (would come from settings in production)
class TwilioConfig:
    """Twilio configuration."""

    account_sid: str = ""
    auth_token: str = ""
    phone_number: str = ""
    messaging_service_sid: str = ""
    enabled: bool = False


_config = TwilioConfig()


def configure_twilio(
    account_sid: str,
    auth_token: str,
    phone_number: str,
    messaging_service_sid: str = "",
) -> None:
    """Configure Twilio credentials.

    Args:
        account_sid: Twilio Account SID
        auth_token: Twilio Auth Token
        phone_number: Twilio phone number for sending
        messaging_service_sid: Optional messaging service SID
    """
    _config.account_sid = account_sid
    _config.auth_token = auth_token
    _config.phone_number = phone_number
    _config.messaging_service_sid = messaging_service_sid
    _config.enabled = bool(account_sid and auth_token)

    logger.info(
        "Twilio configured",
        enabled=_config.enabled,
        phone_number=phone_number[-4:] if phone_number else None,
    )


@lru_cache
def get_twilio_client():
    """Get the Twilio client.

    Returns:
        Twilio client or None if not configured
    """
    if not _config.enabled:
        return None

    try:
        from twilio.rest import Client

        return Client(_config.account_sid, _config.auth_token)
    except ImportError:
        logger.warning("Twilio package not installed")
        return None
    except Exception as e:
        logger.error("Failed to initialize Twilio client", error=str(e))
        return None


async def get_twilio_status() -> str:
    """Get Twilio service status.

    Returns:
        Status string: "available", "not_configured", or "error"
    """
    if not _config.enabled:
        return "not_configured"

    client = get_twilio_client()
    if client is None:
        return "error"

    return "available"


async def send_sms(
    to_phone: str,
    message: str,
    from_phone: str | None = None,
) -> dict[str, Any]:
    """Send an SMS message.

    Args:
        to_phone: Recipient phone number (E.164 format)
        message: Message content
        from_phone: Sender phone number (optional, uses default)

    Returns:
        Send result with status and message SID
    """
    if not _config.enabled:
        logger.info("Twilio not configured, simulating SMS send", to=to_phone)
        return {
            "status": "simulated",
            "message_sid": "SIMULATED",
            "to": to_phone,
            "body": message[:100] + "..." if len(message) > 100 else message,
        }

    client = get_twilio_client()
    if client is None:
        raise RuntimeError("Twilio client not available")

    try:
        message_obj = client.messages.create(
            body=message,
            from_=from_phone or _config.phone_number,
            to=to_phone,
        )

        logger.info(
            "SMS sent",
            to=to_phone[-4:],
            sid=message_obj.sid,
            status=message_obj.status,
        )

        return {
            "status": message_obj.status,
            "message_sid": message_obj.sid,
            "to": to_phone,
        }

    except Exception as e:
        logger.error("Failed to send SMS", error=str(e), to=to_phone[-4:])
        raise


async def make_voice_call(
    to_phone: str,
    twiml_url: str | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    """Make a voice call.

    Args:
        to_phone: Recipient phone number (E.164 format)
        twiml_url: URL returning TwiML for call content
        message: Simple message to speak (uses TTS if no twiml_url)

    Returns:
        Call result with status and call SID
    """
    if not _config.enabled:
        logger.info("Twilio not configured, simulating voice call", to=to_phone)
        return {
            "status": "simulated",
            "call_sid": "SIMULATED",
            "to": to_phone,
        }

    client = get_twilio_client()
    if client is None:
        raise RuntimeError("Twilio client not available")

    try:
        # If message provided, create inline TwiML
        if message and not twiml_url:
            twiml = f"<Response><Say>{message}</Say></Response>"

            call = client.calls.create(
                twiml=twiml,
                from_=_config.phone_number,
                to=to_phone,
            )
        else:
            call = client.calls.create(
                url=twiml_url,
                from_=_config.phone_number,
                to=to_phone,
            )

        logger.info(
            "Voice call initiated",
            to=to_phone[-4:],
            sid=call.sid,
            status=call.status,
        )

        return {
            "status": call.status,
            "call_sid": call.sid,
            "to": to_phone,
        }

    except Exception as e:
        logger.error("Failed to make voice call", error=str(e), to=to_phone[-4:])
        raise


async def send_appointment_reminder(
    patient_phone: str,
    patient_name: str,
    appointment_datetime: datetime,
    provider: str,
    channel: Literal["sms", "call", "email"] = "sms",
    custom_message: str | None = None,
) -> dict[str, Any]:
    """Send an appointment reminder.

    Args:
        patient_phone: Patient's phone number
        patient_name: Patient's name for personalization
        appointment_datetime: Appointment date and time
        provider: Provider/doctor name
        channel: Communication channel (sms, call, email)
        custom_message: Optional custom message template

    Returns:
        Send result with status
    """
    # Format the appointment time
    formatted_time = appointment_datetime.strftime("%A, %B %d at %I:%M %p")

    # Create the message
    if custom_message:
        message = custom_message.format(
            patient_name=patient_name,
            appointment_time=formatted_time,
            provider=provider,
        )
    else:
        message = (
            f"Hi {patient_name}, this is a reminder that you have an appointment "
            f"with {provider} on {formatted_time}. "
            f"Please reply CONFIRM to confirm or CANCEL to cancel."
        )

    # Send via appropriate channel
    if channel == "sms":
        return await send_sms(patient_phone, message)
    elif channel == "call":
        return await make_voice_call(patient_phone, message=message)
    elif channel == "email":
        # Email would be handled by a different integration
        logger.info("Email reminders not yet implemented", patient=patient_name)
        return {
            "status": "not_implemented",
            "channel": "email",
            "message": "Email reminders coming soon",
        }
    else:
        raise ValueError(f"Unknown channel: {channel}")


async def handle_incoming_sms(
    from_phone: str,
    body: str,
    to_phone: str,
) -> dict[str, Any]:
    """Handle incoming SMS messages.

    Processes patient responses to reminders (CONFIRM, CANCEL, etc.)

    Args:
        from_phone: Sender's phone number
        body: Message content
        to_phone: Recipient phone number (our number)

    Returns:
        Response action to take
    """
    body_lower = body.strip().lower()

    # Parse common responses
    if body_lower in ["confirm", "yes", "y", "1"]:
        response_action = "confirm"
        reply_message = "Thank you! Your appointment is confirmed."
    elif body_lower in ["cancel", "no", "n", "0"]:
        response_action = "cancel"
        reply_message = "Your appointment has been cancelled. Please call to reschedule."
    elif body_lower in ["reschedule", "change"]:
        response_action = "reschedule"
        reply_message = "To reschedule, please call our office or visit our patient portal."
    elif body_lower in ["help", "?"]:
        response_action = "help"
        reply_message = (
            "Reply CONFIRM to confirm your appointment, "
            "CANCEL to cancel, or call our office for assistance."
        )
    else:
        response_action = "unknown"
        reply_message = (
            "We didn't understand your response. " "Reply CONFIRM, CANCEL, or HELP for assistance."
        )

    logger.info(
        "Incoming SMS processed",
        from_phone=from_phone[-4:],
        action=response_action,
    )

    return {
        "from_phone": from_phone,
        "original_message": body,
        "action": response_action,
        "reply_message": reply_message,
    }


# Webhook handlers for Twilio callbacks
async def handle_sms_status_callback(
    message_sid: str,
    message_status: str,
    error_code: str | None = None,
) -> dict[str, Any]:
    """Handle SMS delivery status callbacks.

    Args:
        message_sid: Twilio message SID
        message_status: Status (queued, sent, delivered, failed, etc.)
        error_code: Error code if failed

    Returns:
        Processed status
    """
    logger.info(
        "SMS status update",
        sid=message_sid,
        status=message_status,
        error=error_code,
    )

    return {
        "message_sid": message_sid,
        "status": message_status,
        "error_code": error_code,
    }


async def handle_call_status_callback(
    call_sid: str,
    call_status: str,
    duration: int | None = None,
) -> dict[str, Any]:
    """Handle voice call status callbacks.

    Args:
        call_sid: Twilio call SID
        call_status: Status (ringing, in-progress, completed, failed, etc.)
        duration: Call duration in seconds if completed

    Returns:
        Processed status
    """
    logger.info(
        "Call status update",
        sid=call_sid,
        status=call_status,
        duration=duration,
    )

    return {
        "call_sid": call_sid,
        "status": call_status,
        "duration": duration,
    }
