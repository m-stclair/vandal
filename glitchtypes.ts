export type UIControl =
    | {
    type: "range";
    key: string;
    label?: string;
    min: number;
    max: number;
    step?: number;
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
    cleanupHook?: (uuid: string) => void;
};

type PixelEffect = BaseEffect & {
    apply: (imageData: ImageData, config: object) => ImageData;
    styleHook?: never;
};

type VisualEffect = BaseEffect & {
    styleHook: (config: object, uuid: string) => string;
    apply?: never;
};

export type EffectModule = PixelEffect | VisualEffect;
