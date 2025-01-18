"""Sqlite-backed indexing."""

import typing as _t
from decimal import Decimal
import sqlite3
import os
from .web import URLType
from kisstdlib.time import Timestamp


def _time_ns(timestamp: Timestamp) -> int:
    if timestamp == Decimal("Infinity"):
        return 2**63 - 1
    elif timestamp == Decimal("-Infinity"):
        return -(2**63)
    else:
        return int(timestamp * 1_000_000_000)


ValueType = _t.TypeVar("ValueType")


class SqliteIndex(_t.Generic[ValueType]):
    def __init__(
        self,
        root_path: str,
        value_load: _t.Callable[[str], ValueType],
        value_path: _t.Callable[[ValueType], str],
    ) -> None:
        """Initializes a sqlite-backed index for an archive directory."""
        self._conn = sqlite3.connect(os.path.join(root_path, "index.db"))
        self._root_path = root_path
        self._value_load = value_load
        self._value_path = value_path

        self._conn.execute(
            """
            create table if not exists documents (
                url string,
                timestamp integer,  -- Stored as number of nanoseconds since epoch
                path string,  -- Relative to root path
                primary key (url, timestamp, path)
            );
            """
        )
        self._conn.commit()

    def _load_value(self, path: str) -> ValueType:
        dp = os.path.join(self._root_path, path)
        return self._value_load(dp)

    def insert(
        self, url: URLType, time: Timestamp, value: ValueType, ideal: Timestamp | None
    ) -> bool:
        time_ns = _time_ns(time)
        if ideal is not None:
            ideal_ns = _time_ns(ideal)
            self._conn.execute(
                "delete from documents where url = ? and ABS(timestamp - ?) < ?",
                (url, ideal_ns, abs(time_ns - ideal_ns)),
            )
        num_inserted = self._conn.execute(
            "insert or replace into documents values (?, ?, ?);",
            (
                url,
                time_ns,
                os.path.relpath(self._value_path(value), self._root_path),
            ),
        ).rowcount
        self._conn.commit()
        return num_inserted > 0

    @property
    def size(self) -> int:
        """The total number of documents in the archive."""
        (count,) = self._conn.execute("select count(*) from documents;").fetchone()
        return count  # type: ignore

    def keys(self) -> _t.Iterable[URLType]:
        """URLs of all documents in the archive, without duplicates."""
        for (v,) in self._conn.execute("select distinct url from documents;"):
            yield v

    def iter_from_to(
        self, key: URLType, start: Timestamp, end: Timestamp
    ) -> _t.Iterator[tuple[Timestamp, ValueType]]:
        rows = self._conn.execute(
            """
            select timestamp, path from documents
            where url = ? and ? <= timestamp and timestamp < ?;
            """,
            (key, _time_ns(start), _time_ns(end)),
        )
        for timestamp, path in rows:
            yield Timestamp.from_ns(timestamp), self._load_value(path)

    def iter_from_nearest(
        self, key: URLType, ideal: Timestamp
    ) -> _t.Iterator[tuple[Timestamp, ValueType]]:
        rows = self._conn.execute(
            """
            select timestamp, path from documents
            where url = ?
            order by ABS(timestamp - ?);
            """,
            (key, _time_ns(ideal)),
        )
        for timestamp, path in rows:
            yield Timestamp.from_ns(timestamp), self._load_value(path)

    def iter_nearest(
        self,
        key: URLType,
        ideal: Timestamp,
        predicate: _t.Callable[[Timestamp, ValueType], bool] | None = None,
    ) -> _t.Iterator[tuple[Timestamp, ValueType]]:
        if predicate is None:
            yield from self.iter_from_nearest(key, ideal)
        else:
            for e in self.iter_from_nearest(key, ideal):
                if predicate(*e):
                    yield e

    def get_nearest(
        self,
        key: URLType,
        ideal: Timestamp,
        predicate: _t.Callable[[Timestamp, ValueType], bool] | None = None,
    ) -> tuple[Timestamp, ValueType] | None:
        """Of `self[key]` `list` values satisfying `predicate`, get one closest to `ideal`."""
        for e in self.iter_nearest(key, ideal, predicate):
            return e
        return None
