export type Int = number;

export type SVGUrl = string;

export type Primitive = number | boolean | string | null | undefined;
export type NumericArray = number[] | Float32Array | Int32Array | Uint32Array | Uint8Array;
export type NumericMatrix = number[][] | Float32Array[] | Int32Array[];

export type AnimationModType =
    | "none"
    | "sine"
    | "square"
    | "triangle"
    | "saw"
    | "hold"
    | "impulse"
    | "impulse-ease"
    | "walk"
    | "fm-lfo"
    | string;

export interface AnimationMod {
    type: AnimationModType;
    freq?: number;
    phase?: number;
    scale?: number;
    offset?: number;
    [key: string]: any;
}

export interface ModulatedNumber {
    value: number;
    mod?: AnimationMod;
    [key: string]: any;
}

export interface PaletteSwatch {
    color: string;
    locked?: boolean;
    [key: string]: any;
}

export type PaletteValue = Array<string | PaletteSwatch>;

export type ConfigValue = any;
export type ConfigObject = Record<string, any>;

export type OptionValue = string | number | boolean;
export type SelectOption = OptionValue | { label: string; value: OptionValue; [key: string]: any };

export type ShowIfClause = {
    key: string;
    equals?: ConfigValue;
    notEquals?: ConfigValue;
};

export type UIControlType =
    | "range"
    | "Range"
    | "modSlider"
    | "ModSlider"
    | "matrix"
    | "Matrix"
    | "vector"
    | "Vector"
    | "select"
    | "Select"
    | "checkbox"
    | "Checkbox"
    | "referenceImage"
    | "ReferenceImage"
    | "palette"
    | "Palette"
    | "button"
    | "Button"
    | "group"
    | "Group"
    | string;

export type UIScale = "log" | "lin" | "exp" | string;

export interface UIControl {
    type: UIControlType;
    key?: string;
    label?: string;
    min?: number;
    max?: number;
    step?: number | string;
    steps?: number;
    scale?: UIScale;
    scaleFactor?: number;
    options?: SelectOption[];
    size?: [Int, Int] | number[];
    length?: Int;
    subLabels?: string[] | ((config: ConfigObject) => string[]);
    rowLabels?: string[] | ((config: ConfigObject) => string[]);
    colLabels?: string[] | ((config: ConfigObject) => string[]);
    children?: UIControl[];
    kind?: "collapse" | string;
    collapsed?: boolean;
    classes?: string[];
    showIf?: ShowIfClause | ShowIfClause[];
    func?: ButtonHandler;
    inputType?: string;
    accept?: string;
    maxLength?: number;
    allowAdd?: boolean;
    allowRemove?: boolean;
    allowReorder?: boolean;
    allowLock?: boolean;
    allowPaste?: boolean;
    defaultColor?: string;
    defaultValue?: ConfigValue;
    fallbackPalette?: string[] | PaletteValue;
    [key: string]: any;
}

export type EffectPresetMap = {
    [effectId: string]: {
        [label: string]: ConfigObject;
    };
};

export interface RenderTarget {
    fbo: WebGLFramebuffer | null;
    texture: WebGLTexture | null;
    width: number;
    height: number;
    [key: string]: any;
}

export type UniformDefineValue = number | string | boolean | null | undefined;
export type UniformDefines = Record<string, UniformDefineValue>;

export interface WebGLStateLike {
    renderer: any;
    fragSrc?: string | null;
    includeMap?: Record<string, string> | null;
    uniforms?: Record<string, WebGLUniformLocation | null>;
    last_uniforms?: UniformSpec;
    uniformsDirty?: boolean;
    renderGL(
        inputTex: WebGLTexture | Float32Array | NumericArray,
        outputFBO: RenderTarget,
        uniformSpec: UniformSpec,
        defines?: UniformDefines
    ): WebGLTexture | Float32Array | void;
    getOrCreateLUT?(name: string, data: NumericArray | number[]): WebGLTexture;
    [key: string]: any;
}

export type EffectInput = any;
export type EffectOutput = any;

export type ApplyFunc = (
    instance: EffectInstance,
    input: EffectInput,
    width: Int,
    height: Int,
    t: number,
    outputFBO?: RenderTarget
) => EffectOutput;

export type HookResult = Promise<void> | void;
export type EffectHook = (instance: EffectInstance, renderer?: any) => HookResult;

export type ButtonHandler = (
    config: ConfigObject,
    value: ConfigValue,
    event: Event,
    instance: EffectInstance,
    requestRender: () => void,
    requestUIDraw: () => void
) => void | Promise<void>;

export interface BaseEffect {
    name: string;
    defaultConfig: ConfigObject;
    uiLayout: UIControl[];
    cleanupHook?: EffectHook;
    initHook?: EffectHook;
    isGPU?: boolean;
    glState?: WebGLStateLike | null;
    auxiliaryCache?: Record<string, any>;
    effectMeta?: Partial<EffectMeta>;
    meta?: EffectMeta;
    [key: string]: any;
}

export interface PixelEffect extends BaseEffect {
    apply: ApplyFunc;
    styleHook?: never;
}

export interface VisualEffect extends BaseEffect {
    styleHook: (instance: EffectInstance) => SVGUrl;
    apply?: never;
}

export type EffectModule = PixelEffect | VisualEffect;

export interface EffectInstance {
    id: string;
    name: string;
    config: ConfigObject;
    uiLayout?: UIControl[];
    disabled: boolean;
    label?: string;
    solo: boolean;
    isGPU?: boolean;
    ready?: Promise<void>;
    apply?: ApplyFunc;
    styleHook?: (instance: EffectInstance) => SVGUrl;
    cleanupHook?: EffectHook;
    initHook?: EffectHook;
    glState?: WebGLStateLike | null;
    auxiliaryCache?: Record<string, any>;
    meta?: EffectMeta;
    [key: string]: any;
}

export type BackendKind = "cpu" | "gpu" | "hybrid" | string;
export type EffectKind = "pixel" | "visual" | string;

export type ParameterHint = {
    always?: ConfigValue;
    min?: number;
    max?: number;
    aniMin?: number;
    aniMax?: number;
    weights?: Record<string | number, number>;
    [key: string]: any;
};

export interface EffectMeta {
    id?: string;
    name?: string;
    group?: string;
    tags?: string[];
    description?: string;
    backend?: BackendKind;
    kind?: EffectKind;
    canAnimate?: boolean;
    animated?: boolean;
    animatedByDefault?: boolean;
    realtimeSafe?: boolean;
    experimental?: boolean;
    hidden?: boolean;
    stateful?: boolean;
    fullOpacityChance?: number;
    parameterHints?: Record<string, ParameterHint | ConfigValue>;
    [key: string]: any;
}

export interface RegistryEntry {
    id: string;
    name: string;
    group: string;
    tags: string[];
    description: string;
    backend: BackendKind;
    animated?: boolean;
    realtimeSafe?: boolean;
    defaultConfig?: ConfigObject;
    uiLayout?: UIControl[];
    apply?: ApplyFunc;
    styleHook?: (instance: EffectInstance) => SVGUrl;
    cleanupHook?: EffectHook;
    initHook?: EffectHook;
    isGPU?: boolean;
    meta: EffectMeta;
    [key: string]: any;
}

export type UniformScalarType = "float" | "int" | "bool";
export type UniformVectorType = "vec2" | "vec3" | "vec4";
export type UniformMatrixType = "mat2" | "mat3" | "mat4";
export type UniformArrayType = "intArray" | "floatArray" | "vec2Array" | "vec3Array" | "vec4Array";
export type UniformSpecialType = "texture2D" | "UBO";
export type UniformType =
    | UniformScalarType
    | UniformVectorType
    | UniformMatrixType
    | UniformArrayType
    | UniformSpecialType
    | string;

export type UniformArrayValue = NumericArray | number[] | number[][];
export type UniformValue =
    | number
    | boolean
    | UniformArrayValue
    | WebGLTexture
    | WebGLBuffer
    | null
    | undefined;

export interface UniformDatum {
    type: UniformType;
    value: UniformValue;
    width?: number;
    height?: number;
    binding?: number;
    [key: string]: any;
}

export type UniformSpec = Record<string, UniformDatum>;


declare global {
    type VandalEffectModule = EffectModule;
    type EffectModule = import("./glitchtypes.ts").EffectModule;
    type VandalEffectInstance = EffectInstance;
    type VandalConfigObject = ConfigObject;
    type VandalUIControl = UIControl;
    type VandalUniformSpec = UniformSpec;
}
