import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import mongomock_motor
from .config import MONGODB_URL, DATABASE_NAME

# Resilient DNS configuration for MongoDB Atlas SRV resolution
try:
    import dns.resolver
    res = dns.resolver.Resolver(configure=False)
    res.nameservers = ['8.8.8.8', '1.1.1.1']
    dns.resolver.default_resolver = res
except Exception:
    pass

logger = logging.getLogger("e2ee.db")

class DatabaseManager:
    def __init__(self):
        self._clients = {}
        self.is_mock = False
        self._mock_client = None

    def get_client(self):
        if self.is_mock:
            if self._mock_client is None:
                self._mock_client = mongomock_motor.AsyncMongoMockClient()
            return self._mock_client

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop not in self._clients:
            self._clients[loop] = AsyncIOMotorClient(
                MONGODB_URL,
                serverSelectionTimeoutMS=12000,
                connectTimeoutMS=10000
            )
        return self._clients[loop]

    def get_db(self):
        return self.get_client()[DATABASE_NAME]

    @property
    def client(self):
        return self.get_client()

    @property
    def db(self):
        return self.get_db()

db_instance = DatabaseManager()

async def init_db():
    global db_instance
    try:
        logger.info(f"Attempting connection to MongoDB at {MONGODB_URL}...")
        client = db_instance.get_client()
        # Verify connection
        await client.server_info()
        db_instance.is_mock = False
        logger.info(f"Successfully connected to MongoDB ({DATABASE_NAME})")
    except Exception as e:
        logger.warning(f"Could not connect to external MongoDB ({e}). Falling back to in-memory mongomock_motor.")
        db_instance.is_mock = True
        logger.info("Initialized in-memory MongoDB mock client for development/testing.")

    db = db_instance.get_db()

    # Create indexes
    try:
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("pseudonym", unique=True)
        await db.messages.create_index("message_id", unique=True)
        await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
        await db.groups.create_index("group_id", unique=True)
        await db.attachments.create_index("attachment_id", unique=True)
    except Exception as e:
        logger.debug(f"Index creation note: {e}")

    return db

def get_db():
    return db_instance.get_db()

