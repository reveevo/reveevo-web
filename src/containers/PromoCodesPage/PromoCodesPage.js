import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isAdminUser, showCreateListingLinkForUser } from '../../util/userHelpers';

import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H3, H4, InlineTextButton, LayoutSingleColumn, Page, UserNav } from '../../components';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import PromoCodeForm from './PromoCodeForm/PromoCodeForm';
import {
  createPromoCodeThunk,
  deletePromoCodeThunk,
  fetchPromoCodeHistoryThunk,
  updatePromoCodeThunk,
} from './PromoCodesPage.duck';
import css from './PromoCodesPage.module.css';

const { Money } = sdkTypes;

// Error codes from the app's server (statusText), see server/services/promoCodes
const ERROR_MESSAGE_IDS = {
  'not-admin': 'PromoCodesPage.error.notAdmin',
  'feature-unavailable': 'PromoCodesPage.error.unavailable',
  'code-exists': 'PromoCodesPage.error.codeExists',
  'code-in-use': 'PromoCodesPage.error.codeInUse',
  'invalid-percentage': 'PromoCodesPage.error.invalidPercentage',
};
const getErrorMessageId = error =>
  error ? ERROR_MESSAGE_IDS[error.statusText] || 'PromoCodesPage.error.generic' : null;

// The values the server keeps when a promo code is turned on or off
const getUpdateParams = (promoCode, active) => {
  const { discountType, percentage, amount, maxUses, expiresAt } = promoCode;
  return {
    discountType,
    ...(discountType === 'percentage' ? { percentage } : { amount }),
    maxUses,
    // An expired code keeps its date: it can only be turned off
    expiresAt: expiresAt && expiresAt > Date.now() ? new Date(expiresAt).toISOString() : null,
    active,
  };
};

// What ended an order whose code use was given back
const RETURN_REASON_IDS = {
  'transition/provider-decline-order': 'PromoCodesPage.historyReasonDeclined',
};

const PromoCodeHistory = props => {
  const { history, intl } = props;
  const { inProgress, error, entries } = history || {};
  if (inProgress && !entries) {
    return (
      <p className={css.historyNote}>
        <FormattedMessage id="PromoCodesPage.historyLoading" />
      </p>
    );
  }
  if (error) {
    return (
      <p className={css.error}>
        <FormattedMessage id="PromoCodesPage.error.generic" />
      </p>
    );
  }
  if (!entries?.length) {
    return (
      <p className={css.historyNote}>
        <FormattedMessage id="PromoCodesPage.historyEmpty" />
      </p>
    );
  }
  return (
    <ul className={css.history}>
      {entries.map(entry => {
        const { id, type, transactionId, discount, currency, transition, createdAt } = entry;
        const isReturned = type === 'returned';
        const reasonId = isReturned ? RETURN_REASON_IDS[transition] : null;
        return (
          <li key={id} className={css.historyEntry}>
            <span>
              {createdAt
                ? intl.formatDate(createdAt, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : null}
            </span>
            <span className={isReturned ? css.historyReturned : css.historyUsed}>
              <FormattedMessage
                id={isReturned ? 'PromoCodesPage.historyReturned' : 'PromoCodesPage.historyUsed'}
              />
            </span>
            <span>
              {discount != null && currency
                ? `${isReturned ? '+' : '−'}${formatMoney(intl, new Money(discount, currency))}`
                : null}
            </span>
            <span className={css.historyOrder}>
              {transactionId ? (
                <FormattedMessage
                  id="PromoCodesPage.historyOrder"
                  values={{ id: transactionId.slice(0, 8) }}
                />
              ) : null}
              {reasonId ? (
                <>
                  {' · '}
                  <FormattedMessage id={reasonId} />
                </>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

const PromoCodeRow = props => {
  const {
    promoCode,
    intl,
    inProgress,
    history,
    isHistoryOpen,
    onToggleActive,
    onDelete,
    onToggleHistory,
  } = props;
  const { id, code, discountType, percentage, amount, currency, maxUses, usesCount } = promoCode;
  const { expiresAt, active } = promoCode;
  const isExpired = !!expiresAt && expiresAt <= Date.now();
  const isFixed = discountType !== 'percentage';

  const discount = isFixed ? formatMoney(intl, new Money(amount, currency)) : `${percentage}%`;
  const uses = maxUses ? `${usesCount} / ${maxUses}` : `${usesCount}`;
  const expiry = expiresAt
    ? intl.formatDate(expiresAt, { year: 'numeric', month: 'short', day: 'numeric' })
    : intl.formatMessage({ id: 'PromoCodesPage.noExpiry' });
  const statusId = isExpired
    ? 'PromoCodesPage.statusExpired'
    : active
    ? 'PromoCodesPage.statusActive'
    : 'PromoCodesPage.statusInactive';
  const historyId = `PromoCodesPage.history.${id}`;

  return (
    <>
      <tr>
        <td className={css.code}>{code}</td>
        <td>
          {discount}
          {isFixed ? (
            <span className={css.capNote}>
              <FormattedMessage id="PromoCodesPage.fixedCapNote" />
            </span>
          ) : null}
        </td>
        <td>{uses}</td>
        <td>{expiry}</td>
        <td>
          <FormattedMessage id={statusId} />
        </td>
        <td>
          <div className={css.actions}>
            <InlineTextButton
              type="button"
              className={css.action}
              aria-expanded={isHistoryOpen}
              aria-controls={historyId}
              onClick={() => onToggleHistory(promoCode)}
            >
              <FormattedMessage id="PromoCodesPage.history" />
            </InlineTextButton>
            {!isExpired || active ? (
              <InlineTextButton
                type="button"
                className={css.action}
                disabled={inProgress}
                onClick={() => onToggleActive(promoCode, !active)}
              >
                <FormattedMessage
                  id={active ? 'PromoCodesPage.deactivate' : 'PromoCodesPage.activate'}
                />
              </InlineTextButton>
            ) : null}
            {usesCount === 0 ? (
              <InlineTextButton
                type="button"
                className={css.action}
                disabled={inProgress}
                onClick={() => onDelete(promoCode)}
              >
                <FormattedMessage id="PromoCodesPage.delete" />
              </InlineTextButton>
            ) : null}
          </div>
        </td>
      </tr>
      {isHistoryOpen ? (
        <tr id={historyId} className={css.historyRow}>
          <td colSpan={6}>
            <PromoCodeHistory history={history} intl={intl} />
          </td>
        </tr>
      ) : null}
    </>
  );
};

// How Reveevo caps discounts at its commission, with an example
const CommissionCapInfo = props => {
  const { maxPercentage, currency, intl } = props;
  if (maxPercentage == null) {
    return null;
  }
  const money = amount => formatMoney(intl, new Money(amount, currency));
  // A MX$100 code on a MX$200 item
  const itemPrice = 20000;
  return (
    <div className={css.capInfo}>
      <p className={css.capInfoTitle}>
        <FormattedMessage id="PromoCodesPage.capTitle" />
      </p>
      <p className={css.capInfoText}>
        <FormattedMessage id="PromoCodesPage.capText" values={{ maxPercentage }} />
      </p>
      <p className={css.capInfoText}>
        <FormattedMessage
          id="PromoCodesPage.capExample"
          values={{
            itemPrice: money(itemPrice),
            code: money(10000),
            commission: money(Math.round((itemPrice * maxPercentage) / 100)),
          }}
        />
      </p>
    </div>
  );
};

const PromoCodesTable = props => {
  const { promoCodes, intl, actionInProgressId, histories, openHistoryId, ...handlers } = props;
  const columns = ['Code', 'Discount', 'Uses', 'Expires', 'Status'];
  return (
    <div className={css.tableWrapper}>
      <table className={css.table}>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column}>
                <FormattedMessage id={`PromoCodesPage.column${column}`} />
              </th>
            ))}
            <th>
              <span className={css.visuallyHidden}>
                <FormattedMessage id="PromoCodesPage.columnActions" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {promoCodes.map(promoCode => (
            <PromoCodeRow
              key={promoCode.id}
              promoCode={promoCode}
              intl={intl}
              inProgress={actionInProgressId === promoCode.id}
              history={histories[promoCode.id]}
              isHistoryOpen={openHistoryId === promoCode.id}
              {...handlers}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PromoCodesList = props => {
  const { promoCodes, fetchInProgress, actionErrorId, ...tableProps } = props;
  const statusId = fetchInProgress
    ? 'PromoCodesPage.loading'
    : promoCodes.length === 0
    ? 'PromoCodesPage.empty'
    : null;
  return (
    <section className={css.section}>
      <H4 as="h2" className={css.sectionHeading}>
        <FormattedMessage id="PromoCodesPage.listHeading" />
      </H4>
      {actionErrorId ? (
        <p className={css.error}>
          <FormattedMessage id={actionErrorId} />
        </p>
      ) : null}
      {statusId ? (
        <p className={css.description}>
          <FormattedMessage id={statusId} />
        </p>
      ) : (
        <PromoCodesTable promoCodes={promoCodes} {...tableProps} />
      )}
    </section>
  );
};

/**
 * Promo codes for Reveevo's admins (profile.metadata.isAdmin): create marketplace-wide codes,
 * turn them on or off, and delete unused ones. Reveevo pays the discount from its commission,
 * so a code can't be more than the commission.
 *
 * @component
 * @returns {JSX.Element}
 */
const PromoCodesPage = () => {
  const config = useConfiguration();
  const intl = useIntl();
  const dispatch = useDispatch();

  const currentUser = useSelector(state => state.user.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const {
    promoCodes,
    maxPercentage,
    currency,
    fetchInProgress,
    fetchError,
    createInProgress,
    createError,
    actionInProgressId,
    actionError,
    histories,
  } = useSelector(state => state.PromoCodesPage);
  // The code whose history is shown
  const [openHistoryId, setOpenHistoryId] = useState(null);

  const isAdmin = isAdminUser(currentUser);
  const title = intl.formatMessage({ id: 'PromoCodesPage.title' });
  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const fetchErrorId = getErrorMessageId(fetchError);
  const createErrorId = getErrorMessageId(createError);
  const actionErrorId = getErrorMessageId(actionError);

  const handleCreate = values => dispatch(createPromoCodeThunk(values)).unwrap();
  const handleToggleActive = (promoCode, active) =>
    dispatch(
      updatePromoCodeThunk({ id: promoCode.id, values: getUpdateParams(promoCode, active) })
    );
  const handleToggleHistory = promoCode => {
    const isOpen = openHistoryId === promoCode.id;
    setOpenHistoryId(isOpen ? null : promoCode.id);
    if (!isOpen) {
      // Fetched every time it's opened, so new uses and returned uses show up
      dispatch(fetchPromoCodeHistoryThunk(promoCode.id));
    }
  };
  const handleDelete = promoCode => {
    const confirmed = window.confirm(
      intl.formatMessage({ id: 'PromoCodesPage.deleteConfirm' }, { code: promoCode.code })
    );
    if (confirmed) {
      dispatch(deletePromoCodeThunk(promoCode.id));
    }
  };

  const content = !isAdmin ? (
    <p className={css.description}>
      <FormattedMessage id="PromoCodesPage.error.notAdmin" />
    </p>
  ) : fetchErrorId ? (
    <p className={css.error}>
      <FormattedMessage id={fetchErrorId} />
    </p>
  ) : (
    <>
      <CommissionCapInfo
        maxPercentage={maxPercentage}
        currency={currency || config.currency}
        intl={intl}
      />

      <section className={css.section}>
        <H4 as="h2" className={css.sectionHeading}>
          <FormattedMessage id="PromoCodesPage.createHeading" />
        </H4>
        {maxPercentage != null ? (
          <PromoCodeForm
            maxPercentage={maxPercentage}
            currency={currency}
            onSubmit={handleCreate}
            inProgress={createInProgress}
            errorMessage={
              createErrorId ? (
                <FormattedMessage id={createErrorId} values={{ maxPercentage }} />
              ) : null
            }
          />
        ) : null}
      </section>

      <PromoCodesList
        promoCodes={promoCodes}
        fetchInProgress={fetchInProgress}
        actionErrorId={actionErrorId}
        intl={intl}
        actionInProgressId={actionInProgressId}
        histories={histories}
        openHistoryId={openHistoryId}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onToggleHistory={handleToggleHistory}
      />
    </>
  );

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <>
            <TopbarContainer />
            <UserNav currentPage="PromoCodesPage" showManageListingsLink={showManageListingsLink} />
          </>
        }
        footer={<FooterContainer />}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="PromoCodesPage.heading" />
          </H3>
          <p className={css.description}>
            <FormattedMessage id="PromoCodesPage.description" />
          </p>
          {content}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default PromoCodesPage;
