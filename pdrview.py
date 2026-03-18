import json

import multidict
import numpy as np
import pdr
from PIL.Image import Image
from pdr.browsify import _browsify_array


DATA_REGISTRY: dict[str, pdr.Data] = {}


def load_product(path):
    DATA_REGISTRY[path] = pdr.read(path)


def describe_data(data):
    out = {}
    for name in data.keys():
        arr = data[name]
        if not isinstance(arr, np.ndarray):
            # it's a table or something
            continue
        outrec = {}
        if len(arr.shape) == 3:
            outrec['bands'] = arr.shape[0]
            outrec['shape'] = (arr.shape[2], arr.shape[1])
        elif len(arr.shape) == 2:
            outrec['bands'] = 1
            outrec['shape'] = (arr.shape[1], arr.shape[0])
        else:
            continue  # skipping 1-D array
        outrec['type'] = 'array'
        outrec['dtype'] = str(arr.dtype)
        out[name] = outrec
        meta = (
           dict(data.metablock(name))
           if data.metablock(name) is not None
           else dict(data.metadata)
        )
        out[name]['meta'] = to_json_safe(meta)
        if len(arr.shape) == 3:
            out[name]["bands"] = arr.shape[0]
    return json.dumps({"objects": out, 'path': data.filename})


def get_browsified(data, name, band=None):
    # TODO: overly permissive
    try:
        band = int(band)
        override_rgba = True
    except ValueError:
        band = None
        override_rgba = False
    if not isinstance(data[name], np.ndarray):
        # do something bad
        raise TypeError("NOT AN ARRAY!!!!")
    # masking NaNs, special constants, etc.,
    arr: np.ndarray = data.get_scaled(name)
    # letting PIL do the alpha-padding and rotation work
    browsified: Image = _browsify_array(
        arr,
        outbase="",
        save=False,
        image_clip=(1, 1),
        band_ix=band,
        override_rgba=override_rgba
    ).convert('RGBA')
    image_arr = np.ascontiguousarray(browsified)
    return image_arr.ravel(), image_arr.shape


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
    if path not in DATA_REGISTRY:
        load_product(path)
    data = DATA_REGISTRY[path]
    # if objname is None:
    #     objname = get_first_array_objname(data)
    if objname not in data.keys():
        print(data.keys())
        raise KeyError(f"{objname} not in {path}")
    elif not isinstance(data[objname], np.ndarray):
        raise ValueError(f"{objname} is not an array")
    return get_browsified(data, objname, band)


def get_product_info(path):
    if path not in DATA_REGISTRY:
        load_product(path)
    return describe_data(DATA_REGISTRY[path])


