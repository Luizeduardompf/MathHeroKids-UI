/**
 * Reforço profundo — drill de 10 questões mostrado imediatamente depois de errar (ou dar
 * timeout) na Tabuada Semanal Premiada. Interrompe o desafio original: só ao terminar as 10
 * questões (onDone) é que o desafio retoma a pergunta seguinte.
 *
 * Puramente local/efémero — nenhum resultado daqui é enviado ao servidor nem afeta
 * child_fact_mastery/child_fact_retest (ver src/lib/reinforcement.ts). Um erro dentro do
 * próprio drill NÃO dispara um novo reforço (mostra feedback e segue para o próximo passo,
 * sempre) — evita recursão.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { fontFamily, shadows, space } from '@/theme';
import { playSound } from '@/services/sound.service';
import { OPERATION_SYMBOLS, MODULE_ID } from '@/constants/config';
import type { ModuleId } from '@/constants/config';
import { ActionButton, EntranceView, MiloBubble, StatusIcon } from '@/components/challenge/StatusScreens';
import { buildReinforcementScript, deriveFactFamily } from '@/lib/reinforcement';
import type { ReinforcementStep } from '@/lib/reinforcement';

type SubPhase = 'intro' | 'step' | 'feedback' | 'summary';

export function ReinforcementDrill({ operandA, operandB, correctAnswer, operation, onDone }: {
  operandA: number;
  operandB: number;
  correctAnswer: number;
  operation: ModuleId;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [script] = useState<ReinforcementStep[]>(() =>
    buildReinforcementScript(deriveFactFamily(operandA, operandB, correctAnswer, operation)));
  const [stepIndex, setStepIndex] = useState(0);
  const [subPhase, setSubPhase] = useState<SubPhase>('intro');
  const [correctCount, setCorrectCount] = useState(0);
  const [inputDigits, setInputDigits] = useState<number[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState<number | null>(null);

  const step = script[stepIndex];
  const total = script.length;

  const handleDigit = (d: number) => {
    setInputDigits((prev) => (prev.length >= 3 ? prev : [...prev, d]));
  };
  const handleDeleteDigit = () => setInputDigits((prev) => prev.slice(0, -1));

  const submitValue = (value: number) => {
    if (!step) return;
    const isCorrect = value === step.fact.answer;
    setLastCorrect(isCorrect);
    setLastUserAnswer(value);
    if (isCorrect) setCorrectCount((c) => c + 1);
    setSubPhase('feedback');
  };

  const handleSubmitDigits = () => {
    if (inputDigits.length === 0) return;
    submitValue(parseInt(inputDigits.join(''), 10));
  };
  const handleSubmitChoice = () => {
    if (selectedChoice === null) return;
    submitValue(selectedChoice);
  };

  const handleFeedbackContinue = () => {
    const nextIndex = stepIndex + 1;
    setInputDigits([]);
    setSelectedChoice(null);
    if (nextIndex >= total) {
      setSubPhase('summary');
      return;
    }
    setStepIndex(nextIndex);
    setSubPhase('step');
  };

  // Acerto: feedback breve e automático (sem exigir toque, mantém o drill fluido).
  useEffect(() => {
    if (subPhase !== 'feedback' || !lastCorrect) return;
    const timer = setTimeout(handleFeedbackContinue, 700);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPhase, lastCorrect]);

  useEffect(() => {
    if (subPhase === 'feedback') playSound(lastCorrect ? 'correct' : 'wrong');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPhase]);

  // ─── Intro ──────────────────────────────────────────────────────────────────
  if (subPhase === 'intro') {
    return (
      <View style={[rf.root, { backgroundColor: '#EEF2FF' }]}>
        <EntranceView style={rf.body}>
          <StatusIcon name="school" outerBg="rgba(43,82,229,0.15)" innerBg="#2B52E5" outer={112} inner={88} icon={44} />
          <View style={rf.textGroup}>
            <Text style={rf.title}>{t('tabuadaSemanal.reinforcement.introTitle')}</Text>
            <Text style={rf.subtitle}>{t('tabuadaSemanal.reinforcement.introSubtitle')}</Text>
          </View>
        </EntranceView>
        <View style={rf.actions}>
          <ActionButton tone="primary" label={t('tabuadaSemanal.reinforcement.startCta')} onPress={() => setSubPhase('step')} />
        </View>
      </View>
    );
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  if (subPhase === 'summary') {
    return (
      <View style={[rf.root, { backgroundColor: '#ECFDF5' }]}>
        <EntranceView style={rf.body}>
          <StatusIcon name="ribbon" outerBg="rgba(34,197,94,0.18)" innerBg="#22C55E" outer={112} inner={88} icon={44} />
          <View style={rf.textGroup}>
            <Text style={rf.title}>{t('tabuadaSemanal.reinforcement.summaryTitle')}</Text>
            <Text style={rf.subtitle}>
              {t('tabuadaSemanal.reinforcement.summaryScore', { correct: correctCount, total })}
            </Text>
          </View>
        </EntranceView>
        <View style={rf.actions}>
          <ActionButton tone="success" label={t('tabuadaSemanal.reinforcement.summaryCta')} onPress={onDone} />
        </View>
      </View>
    );
  }

  if (!step) return null;

  // ─── Feedback (por passo) ─────────────────────────────────────────────────────
  if (subPhase === 'feedback') {
    return (
      <View style={[rf.root, { backgroundColor: lastCorrect ? '#ECFDF5' : '#FFFBEB' }]}>
        <EntranceView style={rf.body}>
          <StatusIcon
            name={lastCorrect ? 'checkmark' : 'close'}
            outerBg={lastCorrect ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.25)'}
            innerBg={lastCorrect ? '#22C55E' : '#F59E0B'}
            outer={88} inner={72} icon={36}
          />
          <Text style={rf.title}>
            {lastCorrect
              ? t('tabuadaSemanal.reinforcement.correctFeedbackTitle')
              : t('tabuadaSemanal.reinforcement.wrongFeedbackTitle', { answer: step.fact.answer })}
          </Text>
          <EquationRow fact={step.fact} answerOverride={step.fact.answer} />
        </EntranceView>
        {!lastCorrect && (
          <View style={rf.actions}>
            <ActionButton tone="warning" label={t('common.continue')} onPress={handleFeedbackContinue} />
          </View>
        )}
      </View>
    );
  }

  // ─── Step (jogo) ────────────────────────────────────────────────────────────
  return (
    <View style={[rf.root, rf.stepRoot]}>
      <Text style={rf.stepProgress}>
        {t('tabuadaSemanal.reinforcement.stepProgress', { current: stepIndex + 1, total })}
      </Text>

      <View style={rf.stepBody}>
        <EquationRow
          fact={step.fact}
          answerOverride={null}
          inputDisplay={step.inputMode === 'digit' ? (inputDigits.join('') || '?') : (selectedChoice ?? '?')}
          answered={step.inputMode === 'digit' ? inputDigits.length > 0 : selectedChoice !== null}
        />
      </View>

      {step.inputMode === 'digit' ? (
        <StepNumericKeypad
          onDigit={handleDigit}
          onDelete={handleDeleteDigit}
          onSubmit={handleSubmitDigits}
          hasInput={inputDigits.length > 0}
        />
      ) : (
        <View style={rf.choiceArea}>
          <MultipleChoiceGrid
            options={step.choices ?? []}
            selected={selectedChoice}
            onSelect={setSelectedChoice}
          />
          <ActionButton tone="success" label={t('common.confirm')} onPress={handleSubmitChoice} />
        </View>
      )}
    </View>
  );
}

// ─── Equação ────────────────────────────────────────────────────────────────────

function EquationRow({ fact, answerOverride, inputDisplay, answered }: {
  fact: { operandA: number; operandB: number; operation: ModuleId };
  answerOverride: number | null;
  inputDisplay?: number | string;
  answered?: boolean;
}) {
  return (
    <View style={eq.row}>
      <Text style={eq.num}>{fact.operandA}</Text>
      <Text style={eq.op}>{OPERATION_SYMBOLS[fact.operation ?? MODULE_ID.MULTIPLICATION]}</Text>
      <Text style={eq.num}>{fact.operandB}</Text>
      <Text style={eq.op}>=</Text>
      {answerOverride !== null ? (
        <Text style={eq.correct}>{answerOverride}</Text>
      ) : (
        <View style={[eq.answerBox, answered ? eq.answerBoxActive : null] as StyleProp<ViewStyle>}>
          <Text style={eq.answerBoxText}>{inputDisplay}</Text>
        </View>
      )}
    </View>
  );
}

const eq = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', columnGap: 10, rowGap: 8 },
  num: { fontFamily: fontFamily.extraBold, fontSize: 48, lineHeight: 58, color: '#1A1F36', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  op: { fontFamily: fontFamily.extraBold, fontSize: 38, lineHeight: 58, color: '#2B52E5', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  correct: { fontFamily: fontFamily.extraBold, fontSize: 48, lineHeight: 58, color: '#22C55E', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  answerBox: { minWidth: 68, height: 68, borderRadius: 18, borderWidth: 4, borderColor: '#C8CEFF', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  answerBoxActive: { borderStyle: 'solid', borderColor: '#2B52E5', backgroundColor: '#DCE2FF' },
  answerBoxText: { fontFamily: fontFamily.extraBold, fontSize: 48, lineHeight: 58, color: '#2B52E5', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
});

// ─── Teclado numérico (cópia enxuta, mesmo padrão de challenge/[date].tsx) ─────

function StepNumericKeypad({ onDigit, onDelete, onSubmit, hasInput }: {
  onDigit: (d: number) => void; onDelete: () => void; onSubmit: () => void; hasInput: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={kp.keypad}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
        <Pressable
          key={k}
          style={({ pressed }) => [kp.key, pressed ? kp.keyPressed : null] as StyleProp<ViewStyle>}
          onPress={() => onDigit(k)}
        >
          <Text style={kp.keyText}>{k}</Text>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [kp.key, kp.keyMuted, pressed ? kp.keyPressed : null] as StyleProp<ViewStyle>}
        onPress={onDelete}
        accessibilityLabel={t('common.delete')}
      >
        <Ionicons name="backspace-outline" size={24} color="#6B7280" />
      </Pressable>
      <Pressable
        style={({ pressed }) => [kp.key, pressed ? kp.keyPressed : null] as StyleProp<ViewStyle>}
        onPress={() => onDigit(0)}
      >
        <Text style={kp.keyText}>0</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [kp.key, kp.keyConfirm, !hasInput ? kp.keyConfirmDisabled : null, pressed && hasInput ? kp.keyPressed : null] as StyleProp<ViewStyle>}
        onPress={() => { if (hasInput) onSubmit(); }}
        accessibilityLabel={t('common.confirm')}
        accessibilityState={{ disabled: !hasInput }}
      >
        <Ionicons name="checkmark" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const kp = StyleSheet.create({
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  key: { width: '30%', height: 64, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  keyMuted: { backgroundColor: '#EDEEF5' },
  keyConfirm: { backgroundColor: '#22C55E' },
  keyConfirmDisabled: { opacity: 0.5 },
  keyPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  keyText: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, color: '#1A1F36' },
});

// ─── Múltipla escolha ───────────────────────────────────────────────────────────

function MultipleChoiceGrid({ options, selected, onSelect }: {
  options: number[]; selected: number | null; onSelect: (v: number) => void;
}) {
  return (
    <View style={mc.grid}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={({ pressed }) => [
            mc.option,
            selected === opt ? mc.optionSelected : null,
            pressed ? mc.optionPressed : null,
          ] as StyleProp<ViewStyle>}
          onPress={() => onSelect(opt)}
        >
          <Text style={[mc.optionText, ...(selected === opt ? [mc.optionTextSelected] : [])]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const mc = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  option: {
    width: '44%', height: 76, borderRadius: 18, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#E4E5EF', ...shadows.sm,
  },
  optionSelected: { borderColor: '#2B52E5', backgroundColor: '#DCE2FF' },
  optionPressed: { opacity: 0.8 },
  optionText: { fontFamily: fontFamily.bold, fontSize: 30, color: '#1A1F36', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  optionTextSelected: { color: '#2B52E5' },
});

// ─── Layout partilhado ────────────────────────────────────────────────────────

const rf = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32 },
  stepRoot: { backgroundColor: '#EEF1FF', paddingHorizontal: 16 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  textGroup: { alignItems: 'center', gap: 8 },
  title: {
    fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 32, color: '#1A1F36', textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.semiBold, fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, maxWidth: 280,
  },
  actions: { gap: 12, paddingBottom: 8 },
  stepProgress: {
    fontFamily: fontFamily.extraBold, fontSize: 13, color: '#6B7280', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.md,
  },
  stepBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  choiceArea: { gap: space.md },
});
