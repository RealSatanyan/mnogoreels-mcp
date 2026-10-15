import { isInputRequiredResult } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { checkSpendCaps, decideSpendConfirmation } from './spend.js';

describe('checkSpendCaps', () => {
  it.each([
    [{ credits: 5, maxCredits: 5, operatorCap: undefined }, { kind: 'ok' }],
    [{ credits: 5, maxCredits: 5, operatorCap: 5 }, { kind: 'ok' }],
    [
      { credits: 6, maxCredits: 5, operatorCap: undefined },
      { kind: 'spend_cap_exceeded', max: 5 },
    ],
    [
      { credits: 6, maxCredits: 100_000, operatorCap: 5 },
      { kind: 'operator_cap_exceeded', cap: 5 },
    ],
    [
      { credits: 60, maxCredits: 10, operatorCap: 20 },
      { kind: 'operator_cap_exceeded', cap: 20 },
    ],
    [
      { credits: 15, maxCredits: 10, operatorCap: 20 },
      { kind: 'spend_cap_exceeded', max: 10 },
    ],
  ])('%j → %j', (input, expected) => {
    expect(checkSpendCaps(input)).toEqual(expected);
  });
});

const MESSAGE = 'Spend 3 credits on "Talk" (2 min 10 s)? Jobs cannot be cancelled.';

const elicitResponse = (action: 'accept' | 'decline' | 'cancel', content?: Record<string, unknown>) => ({
  confirm_spend: { action, ...(content ? { content } : {}) },
});

describe('decideSpendConfirmation', () => {
  it('proceeds on max_credits alone when the client cannot show a form', () => {
    expect(decideSpendConfirmation({ supportsForm: false, inputResponses: undefined, message: MESSAGE })).toEqual({
      kind: 'proceed',
    });
  });

  it('asks with a form elicitation when there is no answer yet', () => {
    const decision = decideSpendConfirmation({ supportsForm: true, inputResponses: undefined, message: MESSAGE });
    expect(decision.kind).toBe('ask');
    const result = decision.kind === 'ask' ? decision.result : undefined;
    expect(isInputRequiredResult(result)).toBe(true);
    expect(result).toMatchObject({
      inputRequests: {
        confirm_spend: {
          method: 'elicitation/create',
          params: {
            message: MESSAGE,
            requestedSchema: {
              type: 'object',
              properties: {
                confirm: {
                  type: 'boolean',
                  title: 'Spend credits',
                  description: 'Yes, spend the credits shown in the message.',
                },
              },
              required: ['confirm'],
            },
          },
        },
      },
    });
  });

  it('proceeds when the user accepted with confirm=true', () => {
    expect(
      decideSpendConfirmation({
        supportsForm: true,
        inputResponses: elicitResponse('accept', { confirm: true }),
        message: MESSAGE,
      }),
    ).toEqual({ kind: 'proceed' });
  });

  it.each([
    ['accepted with confirm=false', elicitResponse('accept', { confirm: false })],
    ['declined', elicitResponse('decline')],
    ['cancelled', elicitResponse('cancel')],
  ])('declines when the user %s', (_label, inputResponses) => {
    expect(decideSpendConfirmation({ supportsForm: true, inputResponses, message: MESSAGE })).toEqual({
      kind: 'declined',
    });
  });

  it('asks again when the accepted content is malformed', () => {
    const decision = decideSpendConfirmation({
      supportsForm: true,
      inputResponses: elicitResponse('accept', { confirm: 'yes' }),
      message: MESSAGE,
    });
    expect(decision.kind).toBe('ask');
  });

  it('ignores answers to other requests', () => {
    expect(
      decideSpendConfirmation({
        supportsForm: true,
        inputResponses: { other: { action: 'accept', content: { confirm: true } } },
        message: MESSAGE,
      }).kind,
    ).toBe('ask');
  });
});
