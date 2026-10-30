import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage } from '../../../../util/reactIntl';
import { LISTING_STATE_DRAFT, propTypes } from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import {
  getDeliveryAddress,
  getDeliveryAddressFormValues,
  getDeliveryAddressFromFormValues,
} from '../../../../util/deliveryAddress';

// Import global ducks
import { manageDisableScrolling } from '../../../../ducks/ui.duck';
import { saveDeliveryAddress } from '../../../../ducks/deliveryAddress.duck';

// Import shared components
import { DeliveryAddressForm, H3, ListingLink, Modal } from '../../../../components';

// Import modules from this directory
import EditListingDeliveryForm from './EditListingDeliveryForm';
import css from './EditListingDeliveryPanel.module.css';

const getInitialValues = props => {
  const { listing, listingTypes } = props;
  const { geolocation, publicData } = listing?.attributes || {};

  const listingType = listing?.attributes?.publicData?.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === listingType);
  const displayShipping = displayDeliveryShipping(listingTypeConfig);
  const displayPickup = displayDeliveryPickup(listingTypeConfig);
  const displayMultipleDelivery = displayShipping && displayPickup;

  // Only render current search if full place object is available in the URL params
  // TODO bounds are missing - those need to be queried directly from Google Places
  const locationFieldsPresent = publicData?.location?.address && geolocation;
  const location = publicData?.location || {};
  const { address, building } = location;
  const { shippingEnabled, pickupEnabled } = publicData;
  const deliveryOptions = [];

  if (shippingEnabled || (!displayMultipleDelivery && displayShipping)) {
    deliveryOptions.push('shipping');
  }
  if (pickupEnabled || (!displayMultipleDelivery && displayPickup)) {
    deliveryOptions.push('pickup');
  }

  // Initial values for the form
  return {
    building,
    location: locationFieldsPresent
      ? {
          search: address,
          selectedPlace: { address, origin: geolocation },
        }
      : { search: undefined, selectedPlace: undefined },
    deliveryOptions,
  };
};

/**
 * The EditListingDeliveryPanel component.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {propTypes.ownListing} props.listing - The listing object
 * @param {Array<Object>} props.listingTypes - The active listing types configs
 * @param {string} props.marketplaceCurrency - The marketplace currency (e.g. 'USD')
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {Function} props.onSubmit - The submit function
 * @param {string} props.submitButtonText - The submit button text
 * @param {boolean} props.panelUpdated - Whether the panel is updated
 * @param {boolean} props.updateInProgress - Whether the update is in progress
 * @param {Object} props.errors - The errors object
 * @returns {JSX.Element}
 */
const EditListingDeliveryPanel = props => {
  // State is needed since LocationAutocompleteInput doesn't have internal state
  // and therefore re-rendering would overwrite the values during XHR call.
  const [state, setState] = useState({ initialValues: getInitialValues(props) });
  const [isDeliveryAddressModalOpen, setDeliveryAddressModalOpen] = useState(false);

  // Shipping starts from the seller's delivery address (saved to their private data).
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user.currentUser);
  const { saveDeliveryAddressInProgress, saveDeliveryAddressError } = useSelector(
    state => state.deliveryAddress
  );
  const deliveryAddress = getDeliveryAddress(currentUser);
  const onManageDisableScrolling = (componentId, disableScrolling) =>
    dispatch(manageDisableScrolling(componentId, disableScrolling));
  const onSaveDeliveryAddress = values =>
    dispatch(saveDeliveryAddress(getDeliveryAddressFromFormValues(values, currentUser)))
      .then(() => setDeliveryAddressModalOpen(false))
      .catch(() => {
        // Error is shown by the form
      });

  const {
    className,
    rootClassName,
    listing,
    listingTypes,
    marketplaceCurrency,
    disabled,
    ready,
    onSubmit,
    submitButtonText,
    panelUpdated,
    updateInProgress,
    errors,
    updatePageTitle: UpdatePageTitle,
    intl,
  } = props;

  const classes = classNames(rootClassName || css.root, className);
  const isPublished = listing?.id && listing?.attributes.state !== LISTING_STATE_DRAFT;
  const priceCurrencyValid = listing?.attributes?.price?.currency === marketplaceCurrency;
  const listingType = listing?.attributes?.publicData?.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === listingType);

  const panelHeadingProps = isPublished
    ? {
        id: 'EditListingDeliveryPanel.title',
        values: { listingTitle: <ListingLink listing={listing} />, lineBreak: <br /> },
        messageProps: { listingTitle: listing.attributes.title },
      }
    : {
        id: 'EditListingDeliveryPanel.createListingTitle',
        values: { lineBreak: <br /> },
        messageProps: {},
      };

  return (
    <main className={classes}>
      <UpdatePageTitle
        panelHeading={intl.formatMessage(
          { id: panelHeadingProps.id },
          { ...panelHeadingProps.messageProps }
        )}
      />
      <H3 as="h1">
        <FormattedMessage id={panelHeadingProps.id} values={{ ...panelHeadingProps.values }} />
      </H3>
      {priceCurrencyValid ? (
        <EditListingDeliveryForm
          className={css.form}
          initialValues={state.initialValues}
          onSubmit={values => {
            const { building = '', location, deliveryOptions } = values;

            const shippingEnabled = deliveryOptions.includes('shipping');
            const pickupEnabled = deliveryOptions.includes('pickup');
            const address = location?.selectedPlace?.address || null;
            const origin = location?.selectedPlace?.origin || null;

            const pickupDataMaybe =
              pickupEnabled && address ? { location: { address, building } } : {};

            // Note: shipping fee is not set per listing. Reveevo calculates it at checkout
            // from the vehicle needed for the item and the distance (server/services/shipping).

            // New values for listing attributes
            const updateValues = {
              geolocation: origin,
              publicData: {
                pickupEnabled,
                ...pickupDataMaybe,
                shippingEnabled,
              },
            };

            // Save the initialValues to state
            // LocationAutocompleteInput doesn't have internal state
            // and therefore re-rendering would overwrite the values during XHR call.
            setState({
              initialValues: {
                building,
                location: { search: address, selectedPlace: { address, origin } },
                deliveryOptions,
              },
            });
            onSubmit(updateValues);
          }}
          listingTypeConfig={listingTypeConfig}
          saveActionMsg={submitButtonText}
          deliveryAddress={deliveryAddress}
          onOpenDeliveryAddressModal={() => setDeliveryAddressModalOpen(true)}
          disabled={disabled}
          ready={ready}
          updated={panelUpdated}
          updateInProgress={updateInProgress}
          fetchErrors={errors}
          autoFocus
        />
      ) : (
        <div className={css.priceCurrencyInvalid}>
          <FormattedMessage
            id="EditListingPricingPanel.listingPriceCurrencyInvalid"
            values={{ marketplaceCurrency }}
          />
        </div>
      )}
      <Modal
        id="EditListingDeliveryPanel.deliveryAddressModal"
        isOpen={isDeliveryAddressModalOpen}
        onClose={() => setDeliveryAddressModalOpen(false)}
        onManageDisableScrolling={onManageDisableScrolling}
        usePortal
      >
        <H3 as="h2" className={css.modalHeading}>
          <FormattedMessage id="EditListingDeliveryPanel.deliveryAddressModalTitle" />
        </H3>
        <p className={css.modalDescription}>
          <FormattedMessage id="EditListingDeliveryPanel.deliveryAddressModalDescription" />
        </p>
        {isDeliveryAddressModalOpen ? (
          <DeliveryAddressForm
            formId="EditListingDeliveryPanelAddressForm"
            initialValues={getDeliveryAddressFormValues(deliveryAddress, currentUser)}
            onSubmit={onSaveDeliveryAddress}
            inProgress={saveDeliveryAddressInProgress}
            saveError={saveDeliveryAddressError}
          />
        ) : null}
      </Modal>
    </main>
  );
};

export default EditListingDeliveryPanel;
