"""Admin Telegram bot: staff dictate orders by voice, confirm them with one tap and receive new orders.

One bot serves the whole platform. Staff connect with a one-time invite link from the dashboard
("Telegram bot" page). Multi-business (next phase): the telegram_id → business lookup moves to the shared
schema and every update is handled inside that business's schema; nothing here mixes businesses.
"""
