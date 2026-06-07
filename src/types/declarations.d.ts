/**
 * Module declarations for packages whose types aren't resolvable in this env.
 * In CI/prod with a clean npm install these are superseded by the real package types.
 * These stubs cover our ACTUAL import surface — nothing more.
 */

// ─── react-native ────────────────────────────────────────────────────────────
declare module 'react-native' {
  import type { ComponentType, ReactNode, Ref } from 'react';

  // ── Style types ──────────────────────────────────────────────────────────
  export type FlexAlignType = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline' | 'space-between' | 'space-around';
  export interface ViewStyle {
    flex?: number; flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    alignItems?: FlexAlignType; justifyContent?: FlexAlignType | 'space-evenly';
    alignSelf?: FlexAlignType | 'auto'; flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
    gap?: number; rowGap?: number; columnGap?: number;
    width?: number | string; height?: number | string; minWidth?: number; minHeight?: number;
    maxWidth?: number | string; maxHeight?: number | string;
    margin?: number; marginTop?: number; marginBottom?: number; marginLeft?: number; marginRight?: number; marginHorizontal?: number; marginVertical?: number;
    padding?: number; paddingTop?: number; paddingBottom?: number; paddingLeft?: number; paddingRight?: number; paddingHorizontal?: number; paddingVertical?: number;
    backgroundColor?: string; opacity?: number; overflow?: 'visible' | 'hidden' | 'scroll';
    borderRadius?: number; borderWidth?: number; borderColor?: string; borderTopWidth?: number; borderBottomWidth?: number;
    position?: 'absolute' | 'relative'; top?: number; bottom?: number; left?: number; right?: number;
    shadowColor?: string; shadowOpacity?: number; shadowRadius?: number; shadowOffset?: { width: number; height: number }; elevation?: number;
    transform?: object[]; zIndex?: number;
    [key: string]: unknown;
  }
  export interface TextStyle extends ViewStyle {
    color?: string; fontSize?: number; fontWeight?: string; fontFamily?: string; fontStyle?: 'normal' | 'italic';
    lineHeight?: number; letterSpacing?: number; textAlign?: 'left' | 'center' | 'right' | 'justify';
    textDecorationLine?: string; includeFontPadding?: boolean;
  }
  export type StyleProp<T> = T | T[] | null | undefined | false;

  // ── StyleSheet ───────────────────────────────────────────────────────────
  export const StyleSheet: {
    create<T extends Record<string, ViewStyle | TextStyle>>(styles: T): T;
    flatten<T>(style: StyleProp<T>): T;
    compose<T>(a: StyleProp<T>, b: StyleProp<T>): StyleProp<T>;
  };

  // ── Platform ─────────────────────────────────────────────────────────────
  export const Platform: {
    OS: 'ios' | 'android' | 'web';
    select<T>(spec: Partial<Record<'ios' | 'android' | 'web' | 'default', T>>): T;
    Version: number;
  };

  // ── Props types ──────────────────────────────────────────────────────────
  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    testID?: string;
    ref?: Ref<unknown>;
    [key: string]: unknown;
  }
  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: ReactNode;
    variant?: string;
    color?: string;
    align?: string;
    numberOfLines?: number;
    ellipsizeMode?: string;
    selectable?: boolean;
    onPress?: () => void;
    accessible?: boolean;
    accessibilityLabel?: string;
    testID?: string;
    allowFontScaling?: boolean;
    ref?: Ref<unknown>;
    [key: string]: unknown;
  }
  export interface TextInputProps {
    style?: StyleProp<TextStyle>;
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    keyboardType?: string;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    autoComplete?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    multiline?: boolean;
    editable?: boolean;
    ref?: Ref<unknown>;
    [key: string]: unknown;
  }
  export interface PressableProps {
    onPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
    children?: ReactNode;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: Record<string, boolean>;
    [key: string]: unknown;
  }
  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    horizontal?: boolean;
    [key: string]: unknown;
  }

  // ── Core components ──────────────────────────────────────────────────────
  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const ActivityIndicator: ComponentType<{ color?: string; size?: 'small' | 'large'; style?: StyleProp<ViewStyle> }>;
  export const KeyboardAvoidingView: ComponentType<ViewProps & { behavior?: 'padding' | 'height' | 'position' }>;

  // ── Animated ─────────────────────────────────────────────────────────────
  export namespace Animated {
    const View: ComponentType<ViewProps>;
    const Text: ComponentType<TextProps>;
    function createAnimatedComponent<T extends ComponentType<object>>(comp: T): T;
  }
}

// ─── expo-router ─────────────────────────────────────────────────────────────
declare module 'expo-router' {
  import type { ComponentType, ReactNode } from 'react';
  import type { TextStyle, ViewStyle } from 'react-native';

  export type Href = string | { pathname: string; params?: Record<string, string> };

  export interface Router {
    push: (href: Href) => void;
    replace: (href: Href) => void;
    back: () => void;
    navigate: (href: Href) => void;
    canGoBack: () => boolean;
  }

  export function useRouter(): Router;
  export function useSegments<T extends string[]>(): T;
  export function useLocalSearchParams<T extends Record<string, string>>(): T;
  export function useGlobalSearchParams<T extends Record<string, string>>(): T;

  export interface LinkProps { href: Href; children?: ReactNode; style?: TextStyle }
  export function Link(props: LinkProps): JSX.Element;

  export interface RedirectProps { href: Href }
  export function Redirect(props: RedirectProps): JSX.Element;

  export interface StackScreenOptions {
    title?: string;
    headerShown?: boolean;
    animation?: string;
    gestureEnabled?: boolean;
    contentStyle?: ViewStyle;
  }
  export interface StackProps { screenOptions?: StackScreenOptions; children?: ReactNode }
  export interface StackScreenProps { name?: string; options?: StackScreenOptions }
  export const Stack: ComponentType<StackProps> & { Screen: ComponentType<StackScreenProps> };

  export interface TabsScreenOptions {
    title?: string;
    headerShown?: boolean;
    tabBarLabel?: string | ComponentType;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
    tabBarStyle?: ViewStyle;
    tabBarLabelStyle?: TextStyle;
    tabBarActiveTintColor?: string;
    tabBarInactiveTintColor?: string;
    tabBarShowLabel?: boolean;
  }
  export interface TabsProps { screenOptions?: TabsScreenOptions; children?: ReactNode }
  export interface TabsScreenProps { name: string; options?: TabsScreenOptions }
  export const Tabs: ComponentType<TabsProps> & { Screen: ComponentType<TabsScreenProps> };
}

// ─── react-i18next ───────────────────────────────────────────────────────────
declare module 'react-i18next' {
  export function useTranslation(ns?: string): {
    t: (key: string, options?: Record<string, unknown>) => string;
    i18n: import('i18next').i18n;
  };
  export const initReactI18next: import('i18next').Module;
}

// ─── @expo-google-fonts/nunito ────────────────────────────────────────────────
declare module '@expo-google-fonts/nunito' {
  export const Nunito_400Regular: unknown;
  export const Nunito_600SemiBold: unknown;
  export const Nunito_700Bold: unknown;
  export const Nunito_800ExtraBold: unknown;
  export function useFonts(map: Record<string, unknown>): [boolean, Error | null];
}

// ─── react-native-reanimated ─────────────────────────────────────────────────
declare module 'react-native-reanimated' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewStyle, TextStyle, StyleProp } from 'react-native';

  export interface SharedValue<T> { value: T }
  export function useSharedValue<T>(init: T): SharedValue<T>;
  export function useAnimatedStyle(fn: () => StyleProp<ViewStyle>): StyleProp<ViewStyle>;
  export function withTiming(val: number, config?: object): number;
  export function withSpring(val: number, config?: object): number;
  export function createAnimatedComponent<T extends ComponentType<object>>(comp: T): T;

  export interface AnimatedViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    [key: string]: unknown;
  }
  export interface AnimatedTextProps {
    style?: StyleProp<TextStyle>;
    children?: ReactNode;
    [key: string]: unknown;
  }

  namespace Animated {
    const View: ComponentType<AnimatedViewProps>;
    const Text: ComponentType<AnimatedTextProps>;
    function createAnimatedComponent<T extends ComponentType<object>>(comp: T): T;
  }
  export default Animated;
}

// ─── react-native-gesture-handler ────────────────────────────────────────────
declare module 'react-native-gesture-handler' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps } from 'react-native';
  export const GestureHandlerRootView: ComponentType<ViewProps & { children?: ReactNode }>;
}

// ─── @react-native-async-storage/async-storage ───────────────────────────────
declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    getAllKeys(): Promise<string[]>;
    multiGet(keys: string[]): Promise<[string, string | null][]>;
    multiSet(pairs: [string, string][]): Promise<void>;
    multiRemove(keys: string[]): Promise<void>;
  };
  export default AsyncStorage;
}
