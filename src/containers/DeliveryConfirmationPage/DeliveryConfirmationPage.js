import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { confirmHandover } from '../../util/api';
import { storableError } from '../../util/errors';

import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H3, HandoverPinForm, LayoutSingleColumn, Page } from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './DeliveryConfirmationPage.module.css';

/**
 * Page for Reveevo's courier: confirm the delivery of a shipped order with the buyer's PIN.
 * The marketplace team shares the link (/delivery/:id) with the courier. Logging in is not
 * needed - the PIN is the proof that the buyer received the item.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.params - The path params
 * @param {string} props.params.id - The transaction id
 * @returns {JSX.Element}
 */
const DeliveryConfirmationPage = props => {
  const intl = useIntl();
  const [state, setState] = useState({ inProgress: false, error: null, confirmed: false });
  const scrollingDisabled = useSelector(isScrollingDisabled);
  const transactionId = props.params?.id;

  const handleSubmit = values => {
    setState({ inProgress: true, error: null, confirmed: false });
    confirmHandover({ transactionId, pin: values.pin })
      .then(() => setState({ inProgress: false, error: null, confirmed: true }))
      .catch(e => setState({ inProgress: false, error: storableError(e), confirmed: false }));
  };

  return (
    <Page
      title={intl.formatMessage({ id: 'DeliveryConfirmationPage.title' })}
      scrollingDisabled={scrollingDisabled}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="DeliveryConfirmationPage.heading" />
          </H3>
          {state.confirmed ? (
            <p className={css.success}>
              <FormattedMessage id="DeliveryConfirmationPage.confirmed" />
            </p>
          ) : (
            <>
              <p className={css.description}>
                <FormattedMessage id="DeliveryConfirmationPage.description" />
              </p>
              <HandoverPinForm
                formId="DeliveryConfirmationPage"
                onSubmit={handleSubmit}
                inProgress={state.inProgress}
                submitError={state.error}
              />
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default DeliveryConfirmationPage;
