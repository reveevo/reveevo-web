import React from 'react';
import { useSelector } from 'react-redux';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import classNames from 'classnames';
import { ACCOUNT_SETTINGS_PAGES } from '../../routing/routeConfiguration';
import { LinkTabNavHorizontal } from '../../components';
import { isAdminUser } from '../../util/userHelpers';

import css from './UserNav.module.css';

/**
 * A component that renders a navigation bar for a user-specific pages.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {string} props.currentPage - The current page (e.g. 'ManageListingsPage')
 * @returns {JSX.Element} User navigation component
 */
const UserNav = props => {
  const { className, rootClassName, currentPage, showManageListingsLink } = props;
  const intl = useIntl();
  const classes = classNames(rootClassName || css.root, className);

  const manageListingsTabMaybe = showManageListingsLink
    ? [
        {
          text: <FormattedMessage id="UserNav.yourListings" />,
          selected: currentPage === 'ManageListingsPage',
          linkProps: {
            name: 'ManageListingsPage',
          },
        },
      ]
    : [];

  // Reveevo: admins (profile.metadata.isAdmin) manage promo codes
  const currentUser = useSelector(state => state.user?.currentUser);
  const promoCodesTabMaybe = isAdminUser(currentUser)
    ? [
        {
          text: <FormattedMessage id="UserNav.promoCodes" />,
          selected: currentPage === 'PromoCodesPage',
          linkProps: {
            name: 'PromoCodesPage',
          },
        },
      ]
    : [];

  const tabs = [
    ...manageListingsTabMaybe,
    {
      text: <FormattedMessage id="UserNav.profileSettings" />,
      selected: currentPage === 'ProfileSettingsPage',
      disabled: false,
      linkProps: {
        name: 'ProfileSettingsPage',
      },
    },
    {
      text: <FormattedMessage id="UserNav.accountSettings" />,
      selected: ACCOUNT_SETTINGS_PAGES.includes(currentPage),
      disabled: false,
      linkProps: {
        name: 'ContactDetailsPage',
      },
    },
    ...promoCodesTabMaybe,
  ];

  return (
    <LinkTabNavHorizontal
      className={classes}
      tabRootClassName={css.tab}
      tabs={tabs}
      skin="dark"
      ariaLabel={intl.formatMessage({ id: 'UserNav.screenreader.userNav' })}
    />
  );
};

export default UserNav;
