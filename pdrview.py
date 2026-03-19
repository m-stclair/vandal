import dataclasses
import json

import multidict
import numpy as np
import pdr
from PIL.Image import Image
from pdr.browsify import _browsify_array


@dataclasses.dataclass
class ArrayInfo:
    width: int
    height: int
    bands: int
    json_meta: str


# TODO: decide how many of these we actually want to cache
@dataclasses.dataclass
class ArrayObject:
    # scaled pixels padded to 1-D RGBA BIP
    band_pixels: dict[str | int, np.ndarray]
    info: ArrayInfo
    # array scaled and offset to 0-1 f32
    scaled: np.ndarray | None = None


@dataclasses.dataclass
class DummyObject:
    pass


@dataclasses.dataclass
class RegistryEntry:
    data: pdr.Data
    objects: dict[str, ArrayObject | DummyObject]
    populated: bool = False


DATA_REGISTRY: dict[str, RegistryEntry] = {}


def load_product(path):
    data = pdr.read(path)
    DATA_REGISTRY[path] = RegistryEntry(data=data, objects={})


def init_array_object(data, objname):
    arr = data[objname]
    if not isinstance(arr, np.ndarray):
        return None
    if len(arr.shape) == 3:
        bands = arr.shape[0]
        width, height = (arr.shape[2], arr.shape[1])
    elif len(arr.shape) == 2:
        bands = 1
        width, height = (arr.shape[1], arr.shape[0])
    else:
        # not dealing with 1-D arrays
        return None
    meta = (
        dict(data.metablock(objname))
        if data.metablock(objname) is not None
        else dict(data.metadata)
    )
    info = ArrayInfo(
        json_meta=to_json_safe(meta), height=height, width=width, bands=bands
    )
    return ArrayObject(info=info, band_pixels={})


def populate_registry_entry(entry: RegistryEntry):
    data, objects = entry.data, entry.objects
    for objname in data.keys():
        obj = init_array_object(data, objname)
        if obj is None:
            obj = DummyObject()
        objects[objname] = obj
    entry.populated = True


def load_if_required(path):
    if path not in DATA_REGISTRY.keys():
        load_product(path)
    entry = DATA_REGISTRY[path]
    if not entry.populated:
        populate_registry_entry(entry)
    return entry


def describe_data_from_registry(path):
    out = {}
    entry = load_if_required(path)
    for objname, obj in entry.objects.items():
        if isinstance(obj, DummyObject):
            continue
        out[objname] = dataclasses.asdict(obj.info)
    return json.dumps({"objects": out, 'path': entry.data.filename})


# def get_browsified(data, objname, band=None):
#     # TODO: overly permissive
#     try:
#         band = int(band)
#         override_rgba = True
#     except ValueError:
#         band = None
#         override_rgba = False
#     if objname in DATA_REGISTRY[data.filename]['scaled_objects']:
#         arr: np.ma.MaskedArray = (
#             DATA_REGISTRY[data.filename]['scaled_objects'][objname]
#         )
#     else:
#         arr: np.ndarray = data[objname]
#         if not isinstance(arr, np.ndarray):
#             raise TypeError(f"{objname} is not an array; cannot display.")
#         # apply scale/offset, mask special constants, etc.
#         arr = data.get_scaled(objname)
#         arr = np.ma.MaskedArray(arr)
#         arr[~np.isfinite(arr) + arr.mask] = np.nan
#         DATA_REGISTRY[data.filename]['scaled_objects'][objname] = arr.data
#         # we only ever used the scaled object; don't double-cache
#         delattr(data, objname)
#     # let PIL do the alpha-padding and rotation work
#     browsified: Image = _browsify_array(
#         arr,
#         outbase="",
#         save=False,
#         image_clip=(1, 1),
#         band_ix=band,
#         override_rgba=override_rgba
#     ).convert('RGBA')
#     image_arr = np.ascontiguousarray(browsified)
#     return image_arr.ravel(), image_arr.shape


def prep_scaled_f32(data: pdr.Data, objname: str):
    data.load(objname, reload=True)
    arr = data.get_scaled(objname)
    delattr(data, objname)
    arr = np.ma.MaskedArray(arr)
    arr[~np.isfinite(arr) + arr.mask] = np.nan
    offset = np.nanmin(arr)
    scale = np.nanmax(arr) - offset
    arr = ((arr - offset) / scale).astype('f4')
    return arr, scale, offset


def get_scaled_rgba_bip(
    path: str, objname: str, band: str | int | None = None
):
    entry = load_if_required(path)
    if objname not in entry.objects:
        raise ValueError(f"no array named {objname} in {path}")
    obj = entry.objects[objname]
    if isinstance(obj, DummyObject):
        raise TypeError(f"{objname} is not an array")
    if obj.scaled is None:
        scaled, scale, offset = prep_scaled_f32(entry.data, objname)
        obj.scaled = scaled
        obj.scale = scale
        obj.offset = offset
    # TODO, maybe: we could cache these too...
    if obj.bands == 1:
        return to_rgba_bip_1d(obj.scaled)
    if not isinstance(band, int) and obj.bands in (3, 4):
        return to_rgba_bip_1d(obj.scaled[:3])
    # TODO: add arbitrary RGB band selection
    if not isinstance(band, int):
        band = obj.bands // 2
    return to_rgba_bip_1d(obj.scaled[band])


def to_json_safe(meta):
    """
    Flatten MultiDicts into dicts; discard repeated keys,
    stringify stuff. a little inefficient but these structures
    aren't that large.
    """
    if isinstance(meta, multidict.MultiDict):
        meta = dict(meta)
    if isinstance(meta, dict):
        return {k: to_json_safe(v) for k, v in meta.items()}
    elif isinstance(meta, (list, tuple)):
        return [to_json_safe(i) for i in meta]
    try:
        json.dumps(meta)
        return meta
    except TypeError:
        return str(meta)


def get_first_array_objname(data: pdr.Data):
    if len(objnames := get_array_objnames(data)) == 0:
        raise ValueError(f"No images in {data.filename}")
    return objnames[0]


def get_array_objnames(data: pdr.Data):
    return [
        k for k in data.keys() if isinstance(data[k], np.ndarray)
    ]


def get_array_image(path, objname=None, band=None):
    load_if_required(path)
    return get_scaled_rgba_bip(path, objname, band)


def get_product_info(path):
    load_if_required(path)
    return dataclasses.asdict(describe_data_from_registry(path))


def to_rgba_bip_1d(arr: np.ndarray) -> np.ndarray:
    """
    Convert an input ndarray to a 1-D RGBA BIP array.

    Cases handled:
    1) 2D array (H, W): treated as grayscale
       -> [x1, x1, x1, 1, x2, x2, x2, 1, ...]
    2) 3D BSQ array (3, H, W): treated as (R, G, B)
       -> [r1, g1, b1, 1, r2, g2, b2, 1, ...]

    Returns
    -------
    np.ndarray
        Flattened 1-D array in RGBA BIP order.

    Raises
    ------
    ValueError
        If input is not 2D or not a 3-band BSQ 3D array.
    """
    arr = np.asarray(arr)

    if arr.ndim == 2:
        # Grayscale: replicate into R, G, B
        h, w = arr.shape
        alpha = np.ones((h, w), dtype=arr.dtype)
        rgba = np.stack((arr, arr, arr, alpha), axis=-1)  # (H, W, 4)

    elif arr.ndim == 3 and arr.shape[0] == 3:
        # BSQ: (3, H, W) -> split into R, G, B
        r, g, b = arr
        h, w = r.shape
        alpha = np.ones((h, w), dtype=arr.dtype)
        rgba = np.stack((r, g, b, alpha), axis=-1)  # (H, W, 4)

    else:
        raise ValueError(
            f"Expected a 2D array or a 3D BSQ array with shape (3, H, W), got "
            f"{arr.shape}"
        )

    return rgba.reshape(-1)
