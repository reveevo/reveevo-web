import React from 'react';

import { FormattedMessage } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';

import { HandoverPinForm, Heading, Modal } from '../../../components';

import css from './HandoverPinModal.module.css';

/**
 * Modal where the provider enters the buyer's PIN at the pick up.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onManageDisableScrolling
 * @param {Function} props.onSubmit called with { pin }
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.handoverError]
 * @returns {JSX.Element}
 */
const HandoverPinModal = props => {
  const { id, isOpen, onClose, onManageDisableScrolling, ...formProps } = props;
  const { handoverError, ...restFormProps } = formProps;
  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
    >
      <Heading as="h2" rootClassName={css.heading}>
        <FormattedMessage id="HandoverPinModal.title" />
      </Heading>
      <p className={css.description}>
        <FormattedMessage id="HandoverPinModal.description" />
      </p>
      <HandoverPinForm formId={id} submitError={handoverError} {...restFormProps} />
    </Modal>
  );
};

export default HandoverPinModal;
