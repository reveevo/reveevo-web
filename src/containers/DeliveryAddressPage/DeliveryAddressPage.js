import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { showCreateListingLinkForUser, showPaymentDetailsForUser } from '../../util/userHelpers';
import {
  getDeliveryAddress,
  getDeliveryAddressFormValues,
  getDeliveryAddressFromFormValues,
} from '../../util/deliveryAddress';

import { isScrollingDisabled } from '../../ducks/ui.duck';
import { saveDeliveryAddress } from '../../ducks/deliveryAddress.duck';

import { DeliveryAddressForm, H3, LayoutSideNavigation, Page, UserNav } from '../../components';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './DeliveryAddressPage.module.css';

/**
 * Account settings page for the delivery address.
 * The same address is used for shipping when the user sells (ship from) and buys (ship to).
 *
 * @component
 * @returns {JSX.Element}
 */
const DeliveryAddressPage = () => {
  const config = useConfiguration();
  const intl = useIntl();
  const dispatch = useDispatch();
  const [saved, setSaved] = useState(false);

  const currentUser = useSelector(state => state.user.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { saveDeliveryAddressInProgress, saveDeliveryAddressError } = useSelector(
    state => state.deliveryAddress
  );

  const title = intl.formatMessage({ id: 'DeliveryAddressPage.title' });
  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);

  const handleSubmit = values => {
    setSaved(false);
    return dispatch(saveDeliveryAddress(getDeliveryAddressFromFormValues(values, currentUser)))
      .then(() => setSaved(true))
      .catch(() => {
        // Error is shown by the form
      });
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        topbar={
          <>
            <TopbarContainer />
            <UserNav
              currentPage="DeliveryAddressPage"
              showManageListingsLink={showManageListingsLink}
            />
          </>
        }
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={{
          currentPage: 'DeliveryAddressPage',
          showPaymentMethods,
          showPayoutDetails,
        }}
        footer={<FooterContainer />}
        intl={intl}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="DeliveryAddressPage.heading" />
          </H3>
          <p className={css.description}>
            <FormattedMessage id="DeliveryAddressPage.description" />
          </p>
          {currentUser?.id ? (
            <DeliveryAddressForm
              formId="DeliveryAddressPageForm"
              initialValues={getDeliveryAddressFormValues(
                getDeliveryAddress(currentUser),
                currentUser
              )}
              onSubmit={handleSubmit}
              inProgress={saveDeliveryAddressInProgress}
              saveError={saveDeliveryAddressError}
            />
          ) : null}
          {saved ? (
            <p className={css.success}>
              <FormattedMessage id="DeliveryAddressPage.saved" />
            </p>
          ) : null}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

export default DeliveryAddressPage;
