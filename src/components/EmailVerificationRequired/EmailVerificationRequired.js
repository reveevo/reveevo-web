import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { isTooManyEmailVerificationRequestsError } from '../../util/errors';

import { Heading, InlineTextButton, Modal } from '../../components';

import css from './EmailVerificationRequired.module.css';

/**
 * Checks that the current user has verified their email address.
 * Reveevo requires it before buying, making an offer, and publishing a listing.
 *
 * @param {propTypes.currentUser} currentUser
 * @returns {boolean}
 */
export const isEmailVerified = currentUser => !!currentUser?.attributes?.emailVerified;

/**
 * Message that asks the user to verify their email, with a button to resend the email.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {'buy'|'offer'|'publish'} props.action - what the user is trying to do
 * @param {propTypes.currentUser} props.currentUser
 * @param {Function} props.onResendVerificationEmail
 * @param {boolean} [props.sendVerificationEmailInProgress]
 * @param {propTypes.error} [props.sendVerificationEmailError]
 * @returns {JSX.Element}
 */
export const EmailVerificationRequiredMessage = props => {
  const {
    className,
    action,
    currentUser,
    onResendVerificationEmail,
    sendVerificationEmailInProgress,
    sendVerificationEmailError,
  } = props;
  const email = <strong>{currentUser?.attributes?.email}</strong>;
  const resendErrorMessage = isTooManyEmailVerificationRequestsError(sendVerificationEmailError) ? (
    <FormattedMessage id="EmailVerificationRequired.resendFailedTooManyRequests" />
  ) : sendVerificationEmailError ? (
    <FormattedMessage id="EmailVerificationRequired.resendFailed" />
  ) : null;

  return (
    <div className={classNames(css.root, className)}>
      <p className={css.text}>
        <FormattedMessage id={`EmailVerificationRequired.${action}`} values={{ email }} />
      </p>
      <p className={css.text}>
        <FormattedMessage id="EmailVerificationRequired.checkInbox" />{' '}
        <InlineTextButton
          type="button"
          className={css.resendButton}
          onClick={onResendVerificationEmail}
          disabled={sendVerificationEmailInProgress}
        >
          {sendVerificationEmailInProgress ? (
            <FormattedMessage id="EmailVerificationRequired.sending" />
          ) : (
            <FormattedMessage id="EmailVerificationRequired.resend" />
          )}
        </InlineTextButton>
      </p>
      {resendErrorMessage ? <p className={css.error}>{resendErrorMessage}</p> : null}
    </div>
  );
};

/**
 * Modal shown when an unverified user tries to buy, make an offer, or publish a listing.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onManageDisableScrolling
 * @param {'buy'|'offer'|'publish'} props.action
 * @returns {JSX.Element}
 */
const EmailVerificationRequiredModal = props => {
  const { id, isOpen, onClose, onManageDisableScrolling, ...messageProps } = props;
  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
    >
      <Heading as="h2" rootClassName={css.heading}>
        <FormattedMessage id="EmailVerificationRequired.title" />
      </Heading>
      <EmailVerificationRequiredMessage {...messageProps} />
    </Modal>
  );
};

export default EmailVerificationRequiredModal;
