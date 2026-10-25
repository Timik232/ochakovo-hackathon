"""Portable Argon2id PHC hashes; never silently downgrade or truncate passwords."""

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher(
    time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16, type=Type.ID
)


def hash_password(password: str) -> str:
    if not 12 <= len(password) <= 128:
        raise ValueError("Password must contain 12–128 characters")
    return _hasher.hash(password)


def verify_password(password: str, encoded: object) -> bool:
    if not isinstance(encoded, str) or not isinstance(password, str):
        return False
    if not 12 <= len(password) <= 128:
        return False
    # Bound the accepted work factor, retaining compatibility with T2 PHC hashes.
    if not encoded.startswith("$argon2id$v=19$m=65536,t=3,p=4$"):
        return False
    try:
        return _hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError, ValueError, UnicodeError):
        return False
