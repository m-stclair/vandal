import json

import numpy as np
import pdr

DATA_REGISTRY: dict[str, pdr.Data] = {}

def load_product(path):
    DATA_REGISTRY[path] = pdr.read(path)

def describe_data(path):
    if path not in DATA_REGISTRY:
        DATA_REGISTRY[path] = pdr.read(path)
    data = DATA_REGISTRY[path]
    out = {}
    for name in data.keys():
        arr = data[name]
        if not isinstance(arr, np.ndarray):
            # it's a table or something
            continue
        out[name] = {
            "type": 'array',
            "shape": str(arr.shape),
            "dtype": str(arr.dtype),
        }
        meta = (
           dict(data.metablock(name))
           if data.metablock(name) is not None
           else dict(data.metadata)
        )
        out['meta'] = to_json_safe(meta)
        if len(arr.shape) == 3:
            out[name]["bands"] = arr.shape[0]
    return json.dumps({"objects": out})


def get_array_object_normalized(data, name):
    if not isinstance(data[name], np.ndarray):
        # do something bad
        raise TypeError("NOT AN ARRAY!!!!")
    # masking NaNs, special constants, etc., and scaling cleanly
    # to 0-255 for canvas rendering
    arr: np.ndarray = data.get_scaled(name)
    if not arr.dtype.isnative:
        arr = arr.byteswap().view(arr.dtype.newbyteorder("="))
    if arr.dtype != np.float32:
        arr = 255 * (arr - arr.min()) / (arr.max() - arr.min()).astype(np.uint8)
    if arr.flags["C_CONTIGUOUS"] is False:
        arr = np.ascontiguousarray(arr)
    return arr.ravel(), arr.shape


def to_json_safe(meta):
    """Flatten MultiDicts into dicts; discard repeated keys."""
    if isinstance(meta, dict):
        return {k: to_json_safe(v) for k, v in meta.items()}
    elif isinstance(meta, list):
        return [to_json_safe(i) for i in meta]
    else:
        return meta


def get_first_image(path):
    if path not in DATA_REGISTRY:
        load_product(path)
    data = DATA_REGISTRY[path]
    for name in data.keys():
        if not isinstance(data[name], np.ndarray):
            continue
        return get_array_object_normalized(data, name)
    raise ValueError(f"No arrays in {path}")
