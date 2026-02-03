import asyncio
import time
from dataclasses import dataclass
from typing import Any

import aiohttp

ERGAST_BASE = "https://ergast.com/api/f1"
CACHE_TTL_SECONDS = 60


@dataclass
class CacheEntry:
    expires_at: float
    payload: Any


class ErgastClient:
    def __init__(self) -> None:
        self._session: aiohttp.ClientSession | None = None
        self._cache: dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()

    async def __aenter__(self) -> "ErgastClient":
        self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._session:
            await self._session.close()

    async def _get_json(self, path: str) -> dict[str, Any]:
        now = time.time()
        if path in self._cache and self._cache[path].expires_at > now:
            return self._cache[path].payload

        async with self._lock:
            if path in self._cache and self._cache[path].expires_at > now:
                return self._cache[path].payload
            if not self._session:
                self._session = aiohttp.ClientSession()
            url = f"{ERGAST_BASE}/{path}.json"
            async with self._session.get(url, timeout=15) as response:
                response.raise_for_status()
                payload = await response.json()
            self._cache[path] = CacheEntry(
                expires_at=now + CACHE_TTL_SECONDS,
                payload=payload,
            )
            return payload

    async def get_next_race(self) -> dict[str, Any]:
        data = await self._get_json("current/next")
        return data["MRData"]["RaceTable"]["Races"][0]

    async def get_driver_standings(self) -> list[dict[str, Any]]:
        data = await self._get_json("current/driverStandings")
        standings = data["MRData"]["StandingsTable"]["StandingsLists"][0]
        return standings["DriverStandings"]

    async def get_constructor_standings(self) -> list[dict[str, Any]]:
        data = await self._get_json("current/constructorStandings")
        standings = data["MRData"]["StandingsTable"]["StandingsLists"][0]
        return standings["ConstructorStandings"]

    async def get_driver(self, code: str) -> dict[str, Any]:
        data = await self._get_json(f"drivers/{code}")
        drivers = data["MRData"]["DriverTable"]["Drivers"]
        if not drivers:
            raise ValueError("Driver not found")
        return drivers[0]
