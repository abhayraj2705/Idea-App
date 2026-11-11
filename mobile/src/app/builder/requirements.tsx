import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { humanize } from '@/api/adapters';
import { errorMessage } from '@/api/client';
import { aiApi } from '@/api/endpoints/ai';
import type { RequirementsAnswer, RequirementsQuestion } from '@/api/types';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { TextInput } from '@/components/TextInput';
import { FormAlert } from '@/features/auth/AuthLayout';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { useAiModel } from '@/features/builder/useAiModel';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { uuid } from '@/lib/format';
import { useDraft } from '@/stores/draft';
import { font } from '@/theme/fonts';
import { useAppTheme } from '@/theme/theme';

const CATEGORY_LABEL: Record<string, string> = {
  features: 'Features',
  design: 'Design',
  users: 'Users',
  technical: 'Technical',
  scope: 'Scope',
};

const isAnswered = (v?: string) => !!v && v.trim() !== '';

/**
 * Requirements interview. The server reads the idea and asks a handful of
 * clarifying questions; the answers are compiled into the requirements
 * document that drives the plan (POST /requirements → /requirements/compile).
 */
export default function RequirementsStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { draft, update } = useDraft();
  const ai = useAiModel();
  const [formError, setFormError] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: () => aiApi.questions({ userIdea: draft.prompt.trim(), ...ai }),
    onSuccess: (res) => {
      track('requirements_questions', { count: res.questions.length });
      update({
        questions: res.questions,
        questionsFor: draft.prompt.trim(),
        answers: {},
        requirementsDoc: undefined,
        requirements: [],
        wireframe: undefined,
        wireframeApproved: false,
        projectName: draft.projectName || (res.projectName ? humanize(res.projectName) : undefined),
      });
    },
  });

  const suggest = useMutation({
    mutationFn: () => {
      const questions = draft.questions ?? [];
      const open = questions.filter((q) => !isAnswered(draft.answers[q.id])).map((q) => q.id);
      return aiApi.suggestAnswers({
        userIdea: draft.prompt.trim(),
        projectName: draft.projectName,
        questions,
        answers: toAnswers(questions, draft.answers, false),
        questionIds: open,
        ...ai,
      });
    },
    onSuccess: (suggestions) => {
      // Only fills blanks; never overwrites something the user typed meanwhile.
      const current = useDraft.getState().draft.answers;
      const next = { ...current };
      for (const s of suggestions) if (!isAnswered(next[s.questionId]) && s.suggestedAnswer) next[s.questionId] = s.suggestedAnswer;
      update({ answers: next });
      haptics.success();
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const compile = useMutation({
    mutationFn: () =>
      aiApi.compile({
        originalPrompt: draft.prompt.trim(),
        projectName: draft.projectName?.trim() || 'my-app',
        answers: toAnswers(draft.questions ?? [], draft.answers, true),
        ...ai,
      }),
  });

  // Ask (again) when there are no questions yet or the idea changed since they were asked.
  useEffect(() => {
    if (!draft.questions?.length || draft.questionsFor !== draft.prompt.trim()) ask.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const questions = draft.questions ?? [];
  const missingRequired = questions.filter((q) => q.required && !isAnswered(draft.answers[q.id]));
  const openCount = questions.filter((q) => !isAnswered(draft.answers[q.id])).length;
  const loading = ask.isPending;

  const onNext = async () => {
    setFormError(null);
    try {
      const doc = await compile.mutateAsync();
      update({
        requirementsDoc: doc,
        requirements: (doc.coreFeatures ?? []).map((title) => ({ id: uuid(), title: String(title) })),
        projectName: draft.projectName || (doc.projectName ? humanize(doc.projectName) : undefined),
        wireframe: undefined,
        wireframeApproved: false,
      });
      track('requirements_confirmed', { features: doc.coreFeatures?.length ?? 0 });
      return true;
    } catch (e) {
      haptics.error();
      setFormError(errorMessage(e));
      return false;
    }
  };

  return (
    <BuilderScaffold
      step="requirements"
      title={t('builder.questionsTitle')}
      subtitle={t('builder.questionsBody')}
      nextLabel={compile.isPending ? t('builder.compiling') : t('common.continue')}
      nextLoading={compile.isPending}
      nextDisabled={loading || !questions.length || missingRequired.length > 0 || suggest.isPending}
      onNext={onNext}
      footerExtra={
        <>
          {formError ? <FormAlert message={formError} /> : null}
          {questions.length && missingRequired.length ? (
            <HelperText type="info" visible style={{ color: theme.colors.textMuted }}>
              {t('builder.answerRequired', { count: missingRequired.length })}
            </HelperText>
          ) : null}
          {questions.length && openCount > 0 ? (
            <Button
              mode="outlined"
              icon="auto-fix"
              textColor={theme.colors.onSurface}
              style={{ borderColor: theme.colors.border }}
              loading={suggest.isPending}
              disabled={suggest.isPending || compile.isPending}
              onPress={() => {
                setFormError(null);
                suggest.mutate();
              }}
            >
              {suggest.isPending ? t('builder.deciding') : t('builder.decideForMe', { count: openCount })}
            </Button>
          ) : null}
        </>
      }
    >
      {loading ? <LoadingView label={t('builder.readingIdea')} /> : null}
      {ask.isError && !loading ? <ErrorView error={ask.error} onRetry={() => ask.mutate()} /> : null}

      {!loading && questions.length ? (
        <>
          <TextInput
            mode="outlined"
            label={t('builder.projectName')}
            value={draft.projectName ?? ''}
            onChangeText={(projectName) => update({ projectName })}
            maxLength={60}
            outlineColor={theme.colors.border}
          />
          {questions.map((q, i) => (
            <QuestionField
              key={q.id}
              index={i + 1}
              question={q}
              value={draft.answers[q.id] ?? ''}
              onChange={(v) => update({ answers: { ...useDraft.getState().draft.answers, [q.id]: v } })}
            />
          ))}
        </>
      ) : null}
    </BuilderScaffold>
  );
}

function QuestionField({ index, question, value, onChange }: { index: number; question: RequirementsQuestion; value: string; onChange: (v: string) => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.question}>
      <View style={styles.meta}>
        <Text variant="labelMedium" style={[styles.metaText, { color: theme.colors.textMuted }]}>
          {index}. {CATEGORY_LABEL[question.category] ?? humanize(String(question.category))}
        </Text>
        <Text variant="labelMedium" style={{ color: question.required ? theme.colors.primary : theme.colors.textSubtle }}>
          {question.required ? t('builder.required') : t('builder.optional')}
        </Text>
      </View>
      <Text variant="titleSmall" style={styles.qText}>
        {question.question}
      </Text>
      {question.hint ? (
        <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
          {question.hint}
        </Text>
      ) : null}
      <TextInput
        mode="outlined"
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={question.required ? t('builder.yourAnswer') : t('builder.yourAnswerOptional')}
        outlineColor={theme.colors.border}
        style={styles.answer}
        accessibilityLabel={question.question}
        maxLength={1000}
      />
    </View>
  );
}

/** Answers in the server's shape; blanks become "(skipped)" for compile, as the web app sends them. */
function toAnswers(questions: RequirementsQuestion[], answers: Record<string, string>, forCompile: boolean): RequirementsAnswer[] {
  return questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    answer: answers[q.id]?.trim() || (forCompile ? '(skipped)' : ''),
    required: q.required,
  }));
}

const styles = StyleSheet.create({
  question: { gap: 6, paddingTop: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { textTransform: 'uppercase', letterSpacing: 0.4 },
  qText: { fontFamily: font.semibold },
  answer: { minHeight: 72 },
});
