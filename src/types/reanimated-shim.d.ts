/**
 * react-native-reanimated@4.1.7 falha a resolver os named exports de layout animation
 * (LinearTransition, FadeIn, Layout, etc.) sob o moduleResolution "bundler" +
 * customConditions "react-native" do tsconfig do Expo — o módulo em si resolve bem, mas o
 * barrel re-export em index.d.ts fica invisível para o TS (confirmado: falha para todos os
 * exports vindos de ./layoutReanimation, não só LinearTransition). Runtime não é afetado —
 * o JS compilado exporta tudo corretamente, é só um problema dos .d.ts.
 *
 * Augmentation mínima: só o que é usado no projeto.
 */
declare module 'react-native-reanimated' {
  export { LinearTransition } from 'react-native-reanimated/lib/typescript/layoutReanimation/defaultTransitions/LinearTransition';
}
