import React from 'react';
import { Form as FinalForm } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { getHandoverErrorMessageId } from '../../util/handover';
import { required } from '../../util/validators';

import { FieldTextInput, Form, PrimaryButton } from '../../components';

import css from './HandoverPinForm.module.css';

/**
 * Form for entering the buyer's hand-over PIN.
 * Used by the provider at the pick up and by Reveevo's courier at the delivery.
 *
 * @component
 * @param {Object} props
 * @param {string} props.formId
 * @param {Function} props.onSubmit called with { pin }
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.submitError]
 * @returns {JSX.Element}
 */
const HandoverPinForm = props => {
  const intl = useIntl();
  const { formId, onSubmit, inProgress, submitError: handoverError } = props;
  return (
    <FinalForm
      onSubmit={onSubmit}
      render={({ handleSubmit, invalid }) => (
        <Form onSubmit={handleSubmit}>
          <FieldTextInput
            id={`${formId}.pin`}
            name="pin"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={css.field}
            label={intl.formatMessage({ id: 'HandoverPin.pinLabel' })}
            placeholder="123456"
            validate={required(intl.formatMessage({ id: 'HandoverPin.pinRequired' }))}
          />
          {handoverError ? (
            <p className={css.error}>
              <FormattedMessage id={getHandoverErrorMessageId(handoverError)} />
            </p>
          ) : null}
          <PrimaryButton type="submit" inProgress={inProgress} disabled={invalid || inProgress}>
            <FormattedMessage id="HandoverPin.submit" />
          </PrimaryButton>
        </Form>
      )}
    />
  );
};

export default HandoverPinForm;
