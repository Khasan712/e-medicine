import os
from redis.asyncio import Redis

REDIS_HOST = os.getenv("REDIS_HOST", "redis_e_medicine")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_BOT_DB = int(os.getenv("REDIS_BOT_DB", 1))

redis = Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_BOT_DB,
    encoding="utf-8",
    decode_responses=True,  # So we get strings not bytes
)
