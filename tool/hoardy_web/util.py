# Copyright (c) 2024 Jan Malakhovski <oxij@oxij.org>
#
# This file is a part of `hoardy-web` project.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

"""Random utility functions."""

import gzip as _gzip
import io as _io
import typing as _t

from kisstdlib.util import *


def getattr_rec(obj: _t.Any, names: list[str]) -> _t.Any:
    if len(names) == 0:
        return obj

    this, *rest = names
    if hasattr(obj, this):
        return getattr_rec(getattr(obj, this), rest)
    if isinstance(obj, dict) and this in obj:
        return getattr_rec(obj[this], rest)

    raise AttributeError(name=this, obj=obj)


def read_whole_file_maybe(path: str | bytes) -> bytes | None:
    try:
        with open(path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None


def fileobj_content_equals(f: _io.BufferedReader, data: bytes) -> bool:
    # TODO more efficiently
    fdata = f.read()
    return fdata == data


def file_content_equals(path: str | bytes, data: bytes) -> bool:
    try:
        with open(path, "rb") as f:
            return fileobj_content_equals(f, data)
    except FileNotFoundError:
        return False


def gzip_maybe(data: bytes) -> bytes:
    """Given some bytes, return their GZipped version if they compress, return the original otherwise."""

    buf = _io.BytesIO()
    with _gzip.GzipFile(fileobj=buf, filename="", mtime=0, mode="wb", compresslevel=9) as gz:
        gz.write(data)
    compressed_data = buf.getvalue()

    if len(compressed_data) < len(data):
        return compressed_data
    return data


def ungzip_fileobj_maybe(fobj: _io.BufferedReader) -> _io.BufferedReader:
    """UnGZip a file object if it appears to be GZipped."""

    head = fobj.peek(2)[:2]
    if head == b"\037\213":
        fobj = _t.cast(_io.BufferedReader, _gzip.GzipFile(fileobj=fobj, mode="rb"))
    return fobj


PipeType = _t.TypeVar("PipeType")


def make_func_pipe(
    pipe: list[_t.Callable[[PipeType], PipeType]]
) -> _t.Callable[[PipeType], PipeType]:
    def sub(x: PipeType) -> PipeType:
        for func in pipe:
            x = func(x)
        return x

    return sub


EnvType = _t.TypeVar("EnvType")


def make_envfunc_pipe(
    pipe: list[_t.Callable[[EnvType, PipeType], PipeType]]
) -> _t.Callable[[EnvType, PipeType], PipeType]:
    def sub(env: EnvType, x: PipeType) -> PipeType:
        for func in pipe:
            x = func(env, x)
        return x

    return sub
