import {
  TX_TRANSITION_ACTOR_CUSTOMER as CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER as PROVIDER,
  CONDITIONAL_RESOLVER_WILDCARD,
  ConditionalResolver,
} from '../../transactions/transaction';

/**
 * Get state data against product process for TransactionPage's UI.
 * I.e. info about showing action buttons, current state etc.
 *
 * Reveevo (default-purchase release 3):
 * - The provider confirms every order (and the pick-up / collection day) in ConfirmOrderModal.
 * - Offers hold the customer's card. A counter offer is paid (or answered with a new offer) in a
 *   new transaction.
 * - The hand-over is confirmed with the customer's PIN (see HandoverInfo).
 *
 * @param {*} txInfo detials about transaction
 * @param {*} processInfo  details about process
 */
export const getStateDataForPurchaseProcess = (txInfo, processInfo) => {
  const {
    transaction,
    transactionRole,
    nextTransitions,
    onOpenConfirmOrderModal,
    onOpenMakeCounterOfferModal,
    onOpenMakeNewOfferModal,
    onPayCounterOffer,
  } = txInfo;
  const isProviderBanned = transaction?.provider?.attributes?.banned;
  const _ = CONDITIONAL_RESOLVER_WILDCARD;

  const {
    processName,
    processState,
    states,
    transitions,
    actionButtonProps,
    leaveReviewProps,
  } = processInfo;

  const sharedStateData = { processName, processState, showDetailCardHeadings: true };

  return new ConditionalResolver([processState, transactionRole])
    .cond([states.PENDING_CONFIRMATION, PROVIDER], () => {
      return {
        ...sharedStateData,
        showExtraInfo: true,
        showActionButtons: true,
        primaryButtonProps: actionButtonProps(transitions.PROVIDER_CONFIRM_ORDER, PROVIDER, {
          onAction: onOpenConfirmOrderModal,
        }),
        secondaryButtonProps: actionButtonProps(transitions.PROVIDER_DECLINE_ORDER, PROVIDER),
      };
    })
    .cond([states.PENDING_CONFIRMATION, CUSTOMER], () => {
      return { ...sharedStateData, showExtraInfo: true };
    })
    .cond([states.OFFER_PENDING, PROVIDER], () => {
      return {
        ...sharedStateData,
        showExtraInfo: true,
        showActionButtons: true,
        primaryButtonProps: actionButtonProps(transitions.PROVIDER_ACCEPT_OFFER, PROVIDER, {
          onAction: onOpenConfirmOrderModal,
        }),
        secondaryButtonProps: actionButtonProps(transitions.PROVIDER_DECLINE_OFFER, PROVIDER),
        tertiaryButtonProps: actionButtonProps(transitions.PROVIDER_MAKE_COUNTER_OFFER, PROVIDER, {
          onAction: onOpenMakeCounterOfferModal,
        }),
      };
    })
    .cond([states.OFFER_PENDING, CUSTOMER], () => {
      return {
        ...sharedStateData,
        showExtraInfo: true,
        showActionButtons: true,
        secondaryButtonProps: actionButtonProps(transitions.CUSTOMER_WITHDRAW_OFFER, CUSTOMER),
      };
    })
    .cond([states.COUNTER_OFFERED, CUSTOMER], () => {
      // Accepting the counter offer = paying it at once on CheckoutPage (new transaction)
      return {
        ...sharedStateData,
        showExtraInfo: true,
        showActionButtons: !isProviderBanned,
        primaryButtonProps: actionButtonProps(transitions.CUSTOMER_ACCEPT_COUNTER_OFFER, CUSTOMER, {
          onAction: onPayCounterOffer,
        }),
        secondaryButtonProps: actionButtonProps(
          transitions.CUSTOMER_DECLINE_COUNTER_OFFER,
          CUSTOMER
        ),
        tertiaryButtonProps: actionButtonProps(transitions.CUSTOMER_MAKE_COUNTER_OFFER, CUSTOMER, {
          onAction: onOpenMakeNewOfferModal,
        }),
      };
    })
    .cond([states.COUNTER_OFFERED, PROVIDER], () => {
      return { ...sharedStateData, showExtraInfo: true };
    })
    .cond([states.INQUIRY, CUSTOMER], () => {
      const transitionNames = Array.isArray(nextTransitions)
        ? nextTransitions.map(t => t.attributes.name)
        : [];
      const requestAfterInquiry = transitions.REQUEST_PAYMENT_AFTER_INQUIRY;
      const hasCorrectNextTransition = transitionNames.includes(requestAfterInquiry);
      const showOrderPanel = !isProviderBanned && hasCorrectNextTransition;
      return { ...sharedStateData, showOrderPanel };
    })
    .cond([states.PURCHASED, CUSTOMER], () => {
      return {
        ...sharedStateData,
        showActionButtons: true,
        showExtraInfo: true,
        primaryButtonProps: actionButtonProps(transitions.MARK_RECEIVED_FROM_PURCHASED, CUSTOMER),
      };
    })
    .cond([states.PURCHASED, PROVIDER], () => {
      // The hand-over is confirmed with the buyer's PIN (HandoverInfo)
      return { ...sharedStateData, showExtraInfo: true };
    })
    .cond([states.COLLECTED, _], () => {
      return { ...sharedStateData, showExtraInfo: true };
    })
    .cond([states.DELIVERED, CUSTOMER], () => {
      return {
        ...sharedStateData,
        showDispute: true,
        showActionButtons: true,
        primaryButtonProps: actionButtonProps(transitions.MARK_RECEIVED, CUSTOMER),
      };
    })
    .cond([states.COMPLETED, _], () => {
      return {
        ...sharedStateData,
        showReviewAsFirstLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return {
        ...sharedStateData,
        showReviewAsSecondLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return {
        ...sharedStateData,
        showReviewAsSecondLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED, _], () => {
      return { ...sharedStateData, showReviews: true };
    })
    .default(() => {
      // Default values for other states
      return sharedStateData;
    })
    .resolve();
};
