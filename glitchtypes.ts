export type UIControl =
    | {
    type: "range";
    key: string;
    label?: string;
    min: number;
    max: number;
    step?: number;
    steps?: number;
    scale?: "log" | "lin" | "exp";
    scaleFactor?: number;
}
    | {
    type: "select";
    key: string;
    label?: string;
    options: Array<{ label: string; value: any }> | Array<string>;
}
    | {
    type: "checkbox";
    key: string;
    label?: string;
};


export type BaseEffect = {
    name: string;
    defaultConfig: object;
    uiLayout: Array<UIControl>;
    cleanupHook?: (instance: EffectInstance) => void;
    initHook?: (instance: EffectInstance) => void;
};

export type PixelEffect = BaseEffect & {
    apply: (instance: EffectInstance, imageData: ImageData) => ImageData;
    styleHook?: never;
};

export type VisualEffect = BaseEffect & {
    styleHook: (instance: EffectInstance) => string;
    apply?: never;
};

export type EffectModule = PixelEffect | VisualEffect;

export interface EffectInstance {
    id: string;
    name: string;
    config: Record<string, any>;
    apply: (instance: EffectInstance, imageData: ImageData) => ImageData;
    styleHook: (instance: EffectInstance, uuid: string) => string;
    cleanupHook?: () => void;
    uiLayout: UIControl[];
    disabled: boolean;
    // optional per-instance derived data cache
    auxiliaryCache?: Record<string, any>;
    // user-edited name
    label?: string;
    solo: boolean;
}


export type UniformDatum =
    | { type: "float", value: number }
    | { type: "int", value: number }
    | { type: "bool", value: boolean }
    | { type: "vec2", value: [number, number] }
    | { type: "vec3", value: [number, number, number] }
    | { type: "vec4", value: [number, number, number, number] }
    | { type: "mat2", value: Float32Array | number[] }  // length 4
    | { type: "mat3", value: Float32Array | number[] }  // length 9
    | { type: "mat4", value: Float32Array | number[] }  // length 16
    | { type: "floatArray", value: Float32Array | number[] }
    | { type: "intArray", value: Int32Array | number[] }
    | { type: "vec2Array", value: Float32Array | number[] }
    | { type: "vec3Array", value: Float32Array | number[] }
    | { type: "vec4Array", value: Float32Array | number[] };


export type UniformSpec = Record<string, UniformDatum>;