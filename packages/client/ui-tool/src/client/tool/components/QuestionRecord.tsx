import { IconCheckOutlineRegular, IconQuestionOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AskQuestionCardModel } from '../models/ask-question-card-model.ts'
import css from './QuestionRecord.module.css'

/**
 * An answered question set as a card in the conversation: each question with
 * the reader's answers beside it, in the reader's bubble color.
 * @param props.card - the paired questions and answers.
 * @param props.title - localized card title.
 * @param props.action - opens the set's read-only panel, when a panel provider has one.
 * @param props.actionLabel - localized name of `action`.
 * @returns the question record card.
 */
export function QuestionRecord({ card, title, action, actionLabel }: {
  readonly card: Extract<AskQuestionCardModel, { kind: 'answered' }>
  readonly title: string
  readonly action?: (() => boolean) | undefined
  readonly actionLabel?: string | undefined
}) {
  return (
    <section className={css.card} data-question-record aria-label={title}>
      <div className={css.head}>
        <IconQuestionOutlineRegular size={14} />
        <span>{title}</span>
        {action !== undefined && (
          <button type="button" className={css.action} onClick={() => { action() }}>{actionLabel}</button>
        )}
      </div>
      <dl className={css.rows}>
        {card.questions.map(question => (
          <div key={question.id} className={css.row}>
            <dt className={css.question}>{question.question}</dt>
            <dd className={css.answers}>
              {question.answers.length === 0
                ? <span className={css.skipped}>{card.skippedLabel}</span>
                : question.answers.map((answer, index) => (
                  <span key={index} className={css.answer}>
                    <IconCheckOutlineRegular size={12} />
                    {answer}
                  </span>
                ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
