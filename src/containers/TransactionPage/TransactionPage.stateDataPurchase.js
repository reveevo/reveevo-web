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
 * @param {*} txInfo detials about transaction
 * @param {*} processInfo  details about process
 */
export const getStateDataForPurchaseProcess = (txInfo, processInfo) => {
  const { transaction, transactionRole, nextTransitions, onOpenMakeCounterOfferModal } = txInfo;
  const isProviderBanned = transaction?.provider?.attributes?.banned;
  const isShippable = transaction?.attributes?.protectedData?.deliveryMethod === 'shipping';
  const _ = CONDITIONAL_RESOLVER_WILDCARD;

  const {
    processName,
    processState,
    states,
    transitions,
    isCustomer,
    actionButtonProps,
    leaveReviewProps,
  } = processInfo;

  // Both parties can keep countering, but the loop is capped to keep the history readable.
  const counterOfferConditions = role => [
    {
      type: 'maxTransitions',
      action: 'disable',
      max: 50,
      disabledReason: {
        translationKey: `TransactionPage.${processName}.${role}.counterOffer.disabled.maxRequests`,
      },
    },
  ];

  return new ConditionalResolver([processState, transactionRole])
    .cond([states.OFFER_PENDING, CUSTOMER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showExtraInfo: true,
        showActionButtons: true,
        secondaryButtonProps: actionButtonProps(transitions.CUSTOMER_WITHDRAW_OFFER, CUSTOMER),
      };
    })
    .cond([states.OFFER_PENDING, PROVIDER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
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
    .cond([states.COUNTER_OFFER_PENDING, CUSTOMER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showExtraInfo: true,
        showActionButtons: true,
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
        processName,
        processState,
        showOrderPanel,
        // OrderPanel shows the breakdown with the chosen delivery method.
        // The offer's own line items (without delivery) would be a confusing duplicate.
        showBreakDown: !showOrderPanel,
        showDetailCardHeadings: true,
        showExtraInfo: true,
      };
    })
    .cond([states.OFFER_DECLINED, _], () => {
      return { processName, processState, showDetailCardHeadings: true };
    })
    .cond([states.OFFER_WITHDRAWN, _], () => {
      return { processName, processState, showDetailCardHeadings: true };
    })
    .cond([states.OFFER_EXPIRED, _], () => {
      return { processName, processState, showDetailCardHeadings: true };
    })
    .cond([states.INQUIRY, CUSTOMER], () => {
      const transitionNames = Array.isArray(nextTransitions)
        ? nextTransitions.map(t => t.attributes.name)
        : [];
      const requestAfterInquiry = transitions.REQUEST_PAYMENT_AFTER_INQUIRY;
      const hasCorrectNextTransition = transitionNames.includes(requestAfterInquiry);
      const showOrderPanel = !isProviderBanned && hasCorrectNextTransition;
      return { processName, processState, showOrderPanel, showDetailCardHeadings: true };
    })
    .cond([states.INQUIRY, PROVIDER], () => {
      return { processName, processState, showDetailCardHeadings: true };
    })
    .cond([states.PURCHASED, CUSTOMER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showActionButtons: true,
        showExtraInfo: true,
        primaryButtonProps: actionButtonProps(transitions.MARK_RECEIVED_FROM_PURCHASED, CUSTOMER),
      };
    })
    .cond([states.PURCHASED, PROVIDER], () => {
      const actionButtonTranslationId = isShippable
        ? `TransactionPage.${processName}.${PROVIDER}.transition-mark-delivered.actionButtonShipped`
        : `TransactionPage.${processName}.${PROVIDER}.transition-mark-delivered.actionButton`;

      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showActionButtons: true,
        primaryButtonProps: actionButtonProps(transitions.MARK_DELIVERED, PROVIDER, {
          actionButtonTranslationId,
        }),
      };
    })
    .cond([states.DELIVERED, CUSTOMER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showDispute: true,
        showActionButtons: true,
        primaryButtonProps: actionButtonProps(transitions.MARK_RECEIVED, CUSTOMER),
      };
    })
    .cond([states.COMPLETED, _], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showReviewAsFirstLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showReviewAsSecondLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return {
        processName,
        processState,
        showDetailCardHeadings: true,
        showReviewAsSecondLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED, _], () => {
      return { processName, processState, showDetailCardHeadings: true, showReviews: true };
    })
    .default(() => {
      // Default values for other states
      return { processName, processState, showDetailCardHeadings: true };
    })
    .resolve();
};
