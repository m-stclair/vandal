import dataclasses
import json

import multidict
import numpy as np
import pdr


@dataclasses.dataclass
class ArrayInfo:
    width: int
    height: int
    bands: int
    json_meta: str


@dataclasses.dataclass
class BandPixels:
    pixels: np.ndarray  # always 0-1 f32 padded to RGBA BIP
    scale: float
    offset: float


# TODO: decide how many of these we actually want to cache
@dataclasses.dataclass
class ArrayObject:
    # pixels scaled to 0-1 in float32, padded to 1-D RGBA BIP
    band_pixels: dict[str | int, BandPixels]
    info: ArrayInfo
    # MaskedArray with nonfinite values & special constants masked
    masked: np.ndarray | None = None


@dataclasses.dataclass
class DummyObject:
    pass


@dataclasses.dataclass
class RegistryEntry:
    data: pdr.Data
    objects: dict[str, ArrayObject | DummyObject]
    populated: bool = False


DATA_REGISTRY: dict[str, RegistryEntry] = {}


def load_product(path: str):
    data = pdr.read(path)
    DATA_REGISTRY[path] = RegistryEntry(data=data, objects={})


def init_array_object(data: pdr.Data, objname: str) -> ArrayObject | None:
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


def load_if_required(path: str) -> RegistryEntry:
    if path not in DATA_REGISTRY.keys():
        load_product(path)
    entry = DATA_REGISTRY[path]
    if not entry.populated:
        populate_registry_entry(entry)
    return entry


def describe_data_from_registry(path: str) -> str:
    out = {}
    entry = load_if_required(path)
    for objname, obj in entry.objects.items():
        if isinstance(obj, DummyObject):
            continue
        out[objname] = dataclasses.asdict(obj.info)
    return json.dumps({"objects": out, 'path': entry.data.filename})


def prep_masked_array(data: pdr.Data, objname: str) -> np.ma.MaskedArray:
    data.load(objname, reload=True)
    arr = data.get_scaled(objname)
    delattr(data, objname)
    arr = np.ma.masked_invalid(arr)
    return arr


def _scale_and_set(
    obj: ArrayObject, band: int | str, pixels: np.ndarray
) -> BandPixels:
    offset = np.nanmin(pixels)
    scale = np.nanmax(pixels) - offset
    scaled = ((pixels - offset) / scale).astype('f4')
    # TODO: make sure this retains mask
    if isinstance(scaled, np.ma.MaskedArray):
        scaled[scaled.mask] = np.nan
        scaled = scaled.data
    bandpixels = BandPixels(pixels=scaled, scale=scale, offset=offset)
    obj.band_pixels[band] = bandpixels
    return bandpixels


def _get_set_grayscale(obj: ArrayObject, band: int) -> BandPixels:
    if (bandpixels := obj.band_pixels.get(band)) is not None:
        return bandpixels
    if obj.info.bands == 1:
        band = 0
        pixels = to_rgba_bip_1d(obj.masked)
    else:
        pixels = to_rgba_bip_1d(obj.masked[band])
    return _scale_and_set(obj, band, pixels)


def get_scaled_rgba_bip(
    path: str, objname: str, band: str | int | None = None
) -> BandPixels:
    entry = load_if_required(path)
    if objname not in entry.objects:
        raise ValueError(f"no array named {objname} in {path}")
    obj = entry.objects[objname]
    if isinstance(obj, DummyObject):
        raise TypeError(f"{objname} is not an array")
    if obj.masked is None:
        masked = prep_masked_array(entry.data, objname)
        obj.masked = masked
    # NOTE: these look repetitive, but they're legitimately distinct cases
    # 2D array case (always grayscale)
    if obj.info.bands == 1:
        return _get_set_grayscale(obj, 0)
    # RGB case
    # TODO: this is 'default' RGB. if we implement arbitrary 3-band
    #  mapping, that's yet another case
    if not isinstance(band, int) and obj.info.bands in (3, 4):
        if (pixels := obj.band_pixels.get("RGB")) is not None:
            return pixels
        pixels = to_rgba_bip_1d(obj.masked[:3])
        return _scale_and_set(obj, "RGB", pixels)
    # TODO: add arbitrary RGB band selection
    if not isinstance(band, int):
        band = obj.info.bands // 2
    return _get_set_grayscale(obj, band)


def to_json_safe(meta: dict | multidict.MultiDict):
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


def get_first_array_objname(data: pdr.Data) -> str:
    if len(objnames := get_array_objnames(data)) == 0:
        raise ValueError(f"No images in {data.filename}")
    return objnames[0]


def get_array_objnames(data: pdr.Data) -> list[str]:
    return [
        k for k in data.keys() if isinstance(data[k], np.ndarray)
    ]


def get_array_image(
    path: str,
    objname: str | None = None,
    band: str | int | None = None
):
    load_if_required(path)
    bandpixels = get_scaled_rgba_bip(path, objname, band)
    info = DATA_REGISTRY[path].objects[objname].info
    return [
        bandpixels.pixels,
        float(bandpixels.scale),
        float(bandpixels.offset),
        int(info.width),
        int(info.height)
    ]


def get_product_info(path: str) -> str:
    load_if_required(path)
    return describe_data_from_registry(path)


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
