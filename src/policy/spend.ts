import { acceptedContent, inputRequired, inputResponse, type InputRequiredResult } from '@modelcontextprotocol/server';
import { z } from 'zod';

export type SpendCapCheck =
  | { readonly kind: 'ok' }
  | { readonly kind: 'operator_cap_exceeded'; readonly cap: number }
  | { readonly kind: 'spend_cap_exceeded'; readonly max: number };

export type SpendDecision =
  | { readonly kind: 'proceed' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'ask'; readonly result: InputRequiredResult };

const CONFIRM_KEY = 'confirm_spend';

export const ConfirmSpendSchema = z.object({
  confirm: z.boolean().meta({ title: 'Spend credits', description: 'Yes, spend the credits shown in the message.' }),
});

export const checkSpendCaps = (input: {
  readonly credits: number;
  readonly maxCredits: number;
  readonly operatorCap: number | undefined;
}): SpendCapCheck => {
  if (input.operatorCap !== undefined && input.credits > input.operatorCap) {
    return { kind: 'operator_cap_exceeded', cap: input.operatorCap };
  }
  return input.credits > input.maxCredits ? { kind: 'spend_cap_exceeded', max: input.maxCredits } : { kind: 'ok' };
};

export const decideSpendConfirmation = (input: {
  readonly supportsForm: boolean;
  readonly inputResponses: Readonly<Record<string, unknown>> | undefined;
  readonly message: string;
}): SpendDecision => {
  if (!input.supportsForm) return { kind: 'proceed' };
  const view = inputResponse({ ...input.inputResponses }, CONFIRM_KEY);
  if (view.kind === 'elicit' && view.action !== 'accept') return { kind: 'declined' };
  const accepted = acceptedContent({ ...input.inputResponses }, CONFIRM_KEY, ConfirmSpendSchema);
  if (accepted) return accepted.confirm ? { kind: 'proceed' } : { kind: 'declined' };
  return {
    kind: 'ask',
    result: inputRequired({
      inputRequests: {
        [CONFIRM_KEY]: inputRequired.elicit({ message: input.message, requestedSchema: ConfirmSpendSchema }),
      },
    }),
  };
};
