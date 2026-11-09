import React from 'react';
import { Form as FinalForm } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import { HANDOVER_TIME_WINDOWS } from '../../../util/handover';
import { required } from '../../../util/validators';

import { FieldSelect, Form, Heading, Modal, PrimaryButton } from '../../../components';

import css from './ConfirmOrderModal.module.css';

// The provider can choose a day within the next two weeks (orders are canceled after 14 days)
const DAYS_TO_CHOOSE_FROM = 14;

const toDateString = date => {
  const pad = n => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getDateOptions = intl =>
  [...Array(DAYS_TO_CHOOSE_FROM).keys()].map(i => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      value: toDateString(date),
      label: intl.formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' }),
    };
  });

/**
 * Modal where the provider confirms the sale (a direct order or an offer) and chooses the day
 * when the buyer can pick up the item, or when Reveevo can collect it for shipping.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onManageDisableScrolling
 * @param {boolean} props.isShipping
 * @param {Function} props.onSubmit called with { date, timeWindow }
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.confirmError]
 * @returns {JSX.Element}
 */
const ConfirmOrderModal = props => {
  const intl = useIntl();
  const {
    id,
    isOpen,
    onClose,
    onManageDisableScrolling,
    isShipping,
    onSubmit,
    inProgress,
    confirmError,
  } = props;
  const kind = isShipping ? 'shipping' : 'pickup';

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
    >
      <Heading as="h2" rootClassName={css.heading}>
        <FormattedMessage id="ConfirmOrderModal.title" />
      </Heading>
      <p className={css.description}>
        <FormattedMessage id={`ConfirmOrderModal.description.${kind}`} />
      </p>
      <FinalForm
        onSubmit={onSubmit}
        render={({ handleSubmit, invalid }) => (
          <Form onSubmit={handleSubmit}>
            <FieldSelect
              id={`${id}.date`}
              name="date"
              className={css.field}
              label={intl.formatMessage({ id: `ConfirmOrderModal.dateLabel.${kind}` })}
              validate={required(intl.formatMessage({ id: 'ConfirmOrderModal.dateRequired' }))}
            >
              <option disabled value="">
                {intl.formatMessage({ id: 'ConfirmOrderModal.datePlaceholder' })}
              </option>
              {getDateOptions(intl).map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              id={`${id}.timeWindow`}
              name="timeWindow"
              className={css.field}
              label={intl.formatMessage({ id: 'ConfirmOrderModal.timeWindowLabel' })}
              validate={required(
                intl.formatMessage({ id: 'ConfirmOrderModal.timeWindowRequired' })
              )}
            >
              <option disabled value="">
                {intl.formatMessage({ id: 'ConfirmOrderModal.timeWindowPlaceholder' })}
              </option>
              {HANDOVER_TIME_WINDOWS.map(w => (
                <option key={w} value={w}>
                  {intl.formatMessage({ id: `HandoverSlot.timeWindow.${w}` })}
                </option>
              ))}
            </FieldSelect>
            {confirmError ? (
              <p className={css.error}>
                <FormattedMessage id="ConfirmOrderModal.confirmFailed" />
              </p>
            ) : null}
            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={inProgress}
              disabled={invalid || inProgress}
            >
              <FormattedMessage id="ConfirmOrderModal.submit" />
            </PrimaryButton>
          </Form>
        )}
      />
    </Modal>
  );
};

export default ConfirmOrderModal;
