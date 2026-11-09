import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { LINE_ITEM_ITEM, LISTING_UNIT_TYPES } from '../../../util/types';
import { formatMoney } from '../../../util/currency';
import { getProcess, resolveLatestProcessName } from '../../../transactions/transaction';

import { Heading } from '../../../components';

import css from './Offer.module.css';

const { Money } = sdkTypes;

/**
 * Offer section for product purchases that were negotiated with offers (default-purchase process).
 * Shows the latest offer per item, and the previous one if the latest is a counter offer.
 */
const PurchaseOffer = props => {
  const { className, rootClassName, transaction, offers, intl } = props;
  const currency = transaction?.attributes?.payinTotal?.currency;
  const itemLineItem = transaction?.attributes?.lineItems?.find(
    item => item.code === LINE_ITEM_ITEM && !item.reversal
  );
  const quantity = itemLineItem?.quantity?.toNumber?.() || 1;

  const formatOffer = offer =>
    offer?.offerInSubunits ? formatMoney(intl, new Money(offer.offerInSubunits, currency)) : null;
  const currentOffer = formatOffer(offers.at(-1));
  const previousOffer = formatOffer(offers.at(-2));

  if (!currency || !currentOffer) {
    return null;
  }

  const classes = classNames(rootClassName || css.offerContainer, className);
  return (
    <div className={classes}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        <FormattedMessage id="TransactionPage.Offer.heading" />
      </Heading>
      {previousOffer ? (
        <div className={css.quoteRow}>
          <span className={css.quoteLabel}>
            <FormattedMessage id="TransactionPage.Offer.previousOfferLabel" />
          </span>
          <s>
            <FormattedMessage
              id="TransactionPage.Offer.pricePerItem"
              values={{ price: previousOffer, quantity }}
            />
          </s>
        </div>
      ) : null}
      <div className={previousOffer ? css.counterOfferRow : css.quoteRow}>
        <span className={css.quoteLabel}>
          <FormattedMessage id="TransactionPage.Offer.currentOfferLabel" />
        </span>
        <FormattedMessage
          id="TransactionPage.Offer.pricePerItem"
          values={{ price: currentOffer, quantity }}
        />
      </div>
    </div>
  );
};

// Functional component as a helper to build ActivityFeed section
const Offer = props => {
  const {
    className,
    rootClassName,
    transaction,
    transactionRole,
    isNegotiationProcess,
    isPurchaseProcess,
    isRegularNegotiation,
    isProviderBanned,
    intl,
    customTransactionFieldProps,
    transactionFieldsComponent,
  } = props;

  const purchaseOffers = transaction?.attributes?.metadata?.offers;
  if (!isNegotiationProcess && isPurchaseProcess && purchaseOffers?.length > 0) {
    return <PurchaseOffer {...props} offers={purchaseOffers} />;
  } else if (!isNegotiationProcess) {
    return null;
  }

  const isProvider = transactionRole === 'provider';
  const protectedData = transaction?.attributes?.protectedData;
  const offers = transaction?.attributes?.metadata?.offers;
  const providerDefaultMessage = !isProviderBanned
    ? protectedData?.providerDefaultMessage
    : intl.formatMessage({ id: 'TransactionPage.messageSenderBanned' });

  const processName = resolveLatestProcessName(transaction?.attributes?.processName);
  let process = null;
  try {
    process = processName ? getProcess(processName) : null;
  } catch (error) {
    // Process was not recognized!
    return null;
  }

  const hasLineItems = transaction?.attributes?.lineItems?.length > 0;
  const unitLineItem = hasLineItems
    ? transaction.attributes?.lineItems?.find(
        item => LISTING_UNIT_TYPES.includes(item.code) && !item.reversal
      )
    : null;

  // If the customer has made a counter offer,
  // we show the previous offer (that was in pending-offer state) as a quote
  const isCustomerCounterOffer =
    transaction?.attributes?.lastTransition === process.transitions.CUSTOMER_MAKE_COUNTER_OFFER;
  const previousOfferInSubunits = offers?.at(-2)?.offerInSubunits;
  const currency = transaction?.attributes?.payinTotal?.currency;

  const previousOffer =
    isCustomerCounterOffer && previousOfferInSubunits
      ? new Money(previousOfferInSubunits, currency)
      : null;
  const formattedPreviousOffer = previousOffer ? formatMoney(intl, previousOffer) : '';
  const currentOffer = unitLineItem?.lineTotal ? unitLineItem.lineTotal : null;
  const formattedCurrentOffer = currentOffer ? formatMoney(intl, currentOffer) : '';

  const classes = classNames(rootClassName || css.offerContainer, className, {
    [css.reducedMargin]: isRegularNegotiation,
  });
  return formattedCurrentOffer ? (
    <div className={classes}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        <FormattedMessage id="TransactionPage.Offer.heading" />
      </Heading>

      {isCustomerCounterOffer ? (
        <>
          <div className={css.quoteRow}>
            <span className={css.quoteLabel}>
              <FormattedMessage id="TransactionPage.Offer.quoteLabel" />
            </span>
            <s>
              <FormattedMessage
                id="TransactionPage.Offer.quote"
                values={{ quote: formattedPreviousOffer }}
              />
            </s>
          </div>

          <div className={css.counterOfferRow}>
            <span className={css.quoteLabel}>
              <FormattedMessage id="TransactionPage.Offer.counterOfferLabel" />
            </span>
            <FormattedMessage
              id="TransactionPage.Offer.quote"
              values={{ quote: formattedCurrentOffer }}
            />
          </div>
        </>
      ) : (
        <div className={css.quoteRow}>
          <span className={css.quoteLabel}>
            <FormattedMessage id="TransactionPage.Offer.quoteLabel" />
          </span>
          <FormattedMessage
            id="TransactionPage.Offer.quote"
            values={{ quote: formattedCurrentOffer }}
          />
        </div>
      )}

      {transactionFieldsComponent}
    </div>
  ) : null;
};

export default Offer;
