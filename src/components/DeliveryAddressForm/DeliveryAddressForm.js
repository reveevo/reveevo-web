import React, { useEffect } from 'react';
import { Form as FinalForm, useField, useForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import {
  autocompletePlaceSelected,
  autocompleteSearchRequired,
  composeValidators,
  required,
} from '../../util/validators';
import { DELIVERY_COUNTRY_CODE } from '../../util/deliveryAddress';

import {
  FieldLocationAutocompleteInput,
  FieldPhoneNumberInput,
  FieldTextInput,
  Form,
  PrimaryButton,
} from '../../components';

import css from './DeliveryAddressForm.module.css';

const identity = v => v;

// Reveevo delivers only in Mexico: the selected place must be in Mexico.
const placeInDeliveryCountry = message => value =>
  value?.selectedPlace && value.selectedPlace.countryCode !== DELIVERY_COUNTRY_CODE
    ? message
    : undefined;

// When an address is picked from the autocomplete, prefill the neighborhood from it.
// The user can still change it (the field stays editable).
const NeighborhoodAutofill = () => {
  const form = useForm();
  const selectedPlace = useField('location', { subscription: { value: true } }).input.value
    ?.selectedPlace;

  useEffect(() => {
    if (selectedPlace?.neighborhood) {
      form.change('neighborhood', selectedPlace.neighborhood);
    }
  }, [selectedPlace]);

  return null;
};

/**
 * Form for the delivery address that is used for shipping (both selling and buying).
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} props.formId - The form id
 * @param {Object} [props.initialValues] - Initial values: { location, neighborhood, details, phoneNumber }
 * @param {Function} props.onSubmit - Called with the form values
 * @param {boolean} [props.inProgress] - Whether the address is being saved
 * @param {propTypes.error} [props.saveError] - Error from saving the address
 * @param {ReactNode} [props.submitButtonText] - Custom text for the submit button
 * @returns {JSX.Element}
 */
const DeliveryAddressForm = props => {
  const intl = useIntl();
  return (
    <FinalForm
      {...props}
      render={formRenderProps => {
        const {
          className,
          formId,
          handleSubmit,
          invalid,
          pristine,
          inProgress,
          saveError,
          submitButtonText,
          values,
        } = formRenderProps;

        const addressValidators = composeValidators(
          autocompleteSearchRequired(
            intl.formatMessage({ id: 'DeliveryAddressForm.addressRequired' })
          ),
          autocompletePlaceSelected(
            intl.formatMessage({ id: 'DeliveryAddressForm.addressNotRecognized' })
          ),
          placeInDeliveryCountry(
            intl.formatMessage({ id: 'DeliveryAddressForm.addressNotInMexico' })
          )
        );

        return (
          <Form className={classNames(css.root, className)} onSubmit={handleSubmit}>
            <NeighborhoodAutofill />
            <FieldLocationAutocompleteInput
              rootClassName={css.field}
              inputClassName={css.locationAutocompleteInput}
              iconClassName={css.locationAutocompleteInputIcon}
              predictionsClassName={css.predictionsRoot}
              name="location"
              id={`${formId}.location`}
              label={intl.formatMessage({ id: 'DeliveryAddressForm.addressLabel' })}
              placeholder={intl.formatMessage({ id: 'DeliveryAddressForm.addressPlaceholder' })}
              useDefaultPredictions={false}
              countryLimit={[DELIVERY_COUNTRY_CODE]}
              format={identity}
              valueFromForm={values.location}
              validate={addressValidators}
            />
            <FieldTextInput
              className={css.field}
              type="text"
              name="details"
              id={`${formId}.details`}
              label={intl.formatMessage({ id: 'DeliveryAddressForm.detailsLabel' })}
              placeholder={intl.formatMessage({ id: 'DeliveryAddressForm.detailsPlaceholder' })}
            />
            <FieldTextInput
              className={css.field}
              type="text"
              name="neighborhood"
              id={`${formId}.neighborhood`}
              label={intl.formatMessage({ id: 'DeliveryAddressForm.neighborhoodLabel' })}
              placeholder={intl.formatMessage({
                id: 'DeliveryAddressForm.neighborhoodPlaceholder',
              })}
              validate={required(
                intl.formatMessage({ id: 'DeliveryAddressForm.neighborhoodRequired' })
              )}
            />
            <FieldPhoneNumberInput
              className={css.field}
              name="phoneNumber"
              id={`${formId}.phoneNumber`}
              label={intl.formatMessage({ id: 'DeliveryAddressForm.phoneNumberLabel' })}
              placeholder={intl.formatMessage({
                id: 'DeliveryAddressForm.phoneNumberPlaceholder',
              })}
              validate={required(
                intl.formatMessage({ id: 'DeliveryAddressForm.phoneNumberRequired' })
              )}
            />
            {saveError ? (
              <p className={css.error}>
                <FormattedMessage id="DeliveryAddressForm.saveFailed" />
              </p>
            ) : null}
            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={inProgress}
              disabled={invalid || pristine || inProgress}
            >
              {submitButtonText || <FormattedMessage id="DeliveryAddressForm.submit" />}
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default DeliveryAddressForm;
