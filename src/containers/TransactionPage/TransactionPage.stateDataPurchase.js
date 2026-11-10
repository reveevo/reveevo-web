import {
  TX_TRANSITION_ACTOR_CUSTOMER as CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER as PROVIDER,
  CONDITIONAL_RESOLVER_WILDCARD,
  ConditionalResolver,
} from '../../transactions/transaction';
import { MAX_OFFERS_PER_TRANSACTION } from '../../transactions/transactionProcessPurchase';

/**
 * Get state data against product process for TransactionPage's UI.
 * I.e. info about showing action buttons, current state etc.
 *
 * Reveevo (default-purchase release 4):
 * - The provider confirms every paid order (and the pick-up / collection day) in ConfirmOrderModal.
 * - Offers are negotiated in one transaction. Once the price is agreed, the customer pays it
 *   (like after an inquiry), and the provider then confirms the order.
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

  // Both parties can counter, up to MAX_OFFERS_PER_TRANSACTION offers in total. While negotiating,
  // every transition of the transaction is an offer, so the transitions are counted.
  const counterOfferConditions = role => [
    {
      type: 'maxTransitions',
      action: 'disable',
      max: MAX_OFFERS_PER_TRANSACTION,
      disabledReason: {
        translationKey: `TransactionPage.${processName}.${role}.counterOffer.disabled.maxRequests`,
      },
    },
  ];

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
        primaryButtonProps: actionButtonProps(transitions.PROVIDER_ACCEPT_OFFER, PROVIDER),
        secondaryButtonProps: actionButtonProps(transitions.PROVIDER_DECLINE_OFFER, PROVIDER),
        tertiaryButtonProps: actionButtonProps(transitions.PROVIDER_MAKE_COUNTER_OFFER, PROVIDER, {
          onAction: onOpenMakeCounterOfferModal,
          conditions: counterOfferConditions(PROVIDER),
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
    .cond([states.COUNTER_OFFER_PENDING, CUSTOMER], () => {
      return {
        ...sharedStateData,
        showExtraInfo: true,
        showActionButtons: !isProviderBanned,
        primaryButtonProps: actionButtonProps(transitions.CUSTOMER_ACCEPT_COUNTER_OFFER, CUSTOMER),
        secondaryButtonProps: actionButtonProps(
          transitions.CUSTOMER_DECLINE_COUNTER_OFFER,
          CUSTOMER
        ),
        tertiaryButtonProps: actionButtonProps(transitions.CUSTOMER_MAKE_COUNTER_OFFER, CUSTOMER, {
          onAction: onOpenMakeCounterOfferModal,
          conditions: counterOfferConditions(CUSTOMER),
        }),
      };
    })
    .cond([states.OFFER_ACCEPTED, CUSTOMER], () => {
      // Like after an inquiry, the customer chooses the delivery method on OrderPanel
      // and pays the accepted offer on CheckoutPage.
      const transitionNames = Array.isArray(nextTransitions)
        ? nextTransitions.map(t => t.attributes.name)
        : [];
      const hasCorrectNextTransition = transitionNames.includes(
        transitions.REQUEST_PAYMENT_AFTER_OFFER
      );
      const showOrderPanel = !isProviderBanned && hasCorrectNextTransition;
      return {
        ...sharedStateData,
        showOrderPanel,
        // OrderPanel shows the breakdown with the chosen delivery method.
        // The offer's own line items (without delivery) would be a confusing duplicate.
        showBreakDown: !showOrderPanel,
        showExtraInfo: true,
      };
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
