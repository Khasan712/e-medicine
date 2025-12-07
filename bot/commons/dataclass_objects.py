from dataclasses import dataclass
from typing import Optional


@dataclass
class ClientDTO:
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    tg_phone: Optional[str] = None
    tg_id: Optional[str] = None
    tg_nick: Optional[str] = None
    location: Optional[str] = None
    l_t: Optional[str] = None
    e_t: Optional[str] = None
    lang: Optional[str] = None


def dict_to_client_dto(data: dict) -> ClientDTO:
    return ClientDTO(**data)
