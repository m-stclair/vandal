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


type BaseEffect = {
    name: string;
    defaultConfig: object;
    uiLayout: Array<UIControl>;
    cleanupHook?: (instance: EffectInstance) => void;
    initHook?: (instance: EffectInstance) => void;
};

type PixelEffect = BaseEffect & {
    apply: (instance: EffectInstance, imageData: ImageData) => ImageData;
    styleHook?: never;
};

type VisualEffect = BaseEffect & {
    styleHook: (instance: EffectInstance) => string;
    apply?: never;
};

export type EffectModule = PixelEffect | VisualEffect;

interface EffectInstance {
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
