import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { fetchHandoverPin } from '../../../util/api';

import { Heading, SecondaryButton } from '../../../components';

import css from './HandoverInfo.module.css';

// States where the order is confirmed and waiting for the hand-over (default-purchase release 3)
const HANDOVER_STATES = ['purchased', 'collected'];

/**
 * Formats the confirmed hand-over slot, e.g. "Tuesday, November 12 · Morning".
 *
 * @param {Object} intl
 * @param {{ date: string, timeWindow: string }} handoverSlot
 * @returns {string|null}
 */
export const formatHandoverSlot = (intl, handoverSlot) => {
  const { date, timeWindow } = handoverSlot || {};
  if (!date) {
    return null;
  }
  const formattedDate = intl.formatDate(new Date(`${date}T12:00:00`), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedWindow = timeWindow
    ? intl.formatMessage({ id: `HandoverSlot.timeWindow.${timeWindow}` })
    : null;
  return formattedWindow ? `${formattedDate} · ${formattedWindow}` : formattedDate;
};

/**
 * Hand-over details of a confirmed product order:
 * - the pick-up / collection day the provider confirmed
 * - customer: their PIN (they give it at the pick up / delivery)
 * - provider (pick up): button to enter the buyer's PIN
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {Object} props.transaction
 * @param {'customer'|'provider'} props.transactionRole
 * @param {string} props.processState
 * @param {Function} props.onOpenHandoverPinModal
 * @returns {JSX.Element|null}
 */
const HandoverInfo = props => {
  const intl = useIntl();
  const [pin, setPin] = useState(null);
  const { className, transaction, transactionRole, processState, onOpenHandoverPinModal } = props;
  const isCustomer = transactionRole === 'customer';
  const isHandoverState = HANDOVER_STATES.includes(processState);
  const protectedData = transaction?.attributes?.protectedData || {};
  const isShipping = protectedData.deliveryMethod === 'shipping';
  const transactionId = transaction?.id?.uuid;

  // The PIN is only shown to the customer, and it's fetched from the server (client-side only)
  useEffect(() => {
    if (isCustomer && isHandoverState && transactionId) {
      fetchHandoverPin({ transactionId })
        .then(response => setPin(response?.data?.pin || null))
        .catch(() => setPin(null));
    }
  }, [isCustomer, isHandoverState, transactionId]);

  if (!isHandoverState) {
    return null;
  }

  const slot = formatHandoverSlot(intl, protectedData.handoverSlot);
  const kind = isShipping ? 'shipping' : 'pickup';

  return (
    <div className={classNames(css.root, className)}>
      <Heading as="h2" rootClassName={css.heading}>
        <FormattedMessage id={`HandoverInfo.heading.${kind}`} />
      </Heading>
      {slot ? (
        <p className={css.slot}>
          <FormattedMessage id={`HandoverInfo.slot.${kind}.${transactionRole}`} values={{ slot }} />
        </p>
      ) : null}
      {isCustomer ? (
        <>
          <p className={css.pinLabel}>
            <FormattedMessage id={`HandoverInfo.pinInfo.${kind}`} />
          </p>
          <p className={css.pin}>{pin || '······'}</p>
        </>
      ) : isShipping ? (
        <p className={css.info}>
          <FormattedMessage id="HandoverInfo.providerShippingInfo" />
        </p>
      ) : (
        <>
          <p className={css.info}>
            <FormattedMessage id="HandoverInfo.providerPickupInfo" />
          </p>
          <SecondaryButton className={css.pinButton} onClick={onOpenHandoverPinModal}>
            <FormattedMessage id="HandoverInfo.enterPin" />
          </SecondaryButton>
        </>
      )}
    </div>
  );
};

export default HandoverInfo;
