import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import { Link } from './Link';

const { screen } = testingLibrary;

describe('PageBuilder Link', () => {
  it('reads an in-app link without the leading slash from the root', () => {
    render(<Link href="s?pub_categoryLevel1=dining">Dining</Link>);
    expect(screen.getByText('Dining').getAttribute('href')).toBe('/s?pub_categoryLevel1=dining');
  });

  it('keeps external links, mailto links and anchors as they are', () => {
    render(
      <>
        <Link href="https://example.com/a">External</Link>
        <Link href="mailto:support@example.com">Email</Link>
      </>
    );
    expect(screen.getByText('External').getAttribute('href')).toBe('https://example.com/a');
    expect(screen.getByText('Email').getAttribute('href')).toBe('mailto:support@example.com');
  });
});
