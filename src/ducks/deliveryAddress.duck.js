import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { storableError } from '../util/errors';
import { denormalisedResponseEntities } from '../util/data';
import { DELIVERY_ADDRESS_KEY } from '../util/deliveryAddress';
import * as log from '../util/log';

import { setCurrentUser } from './user.duck';

// ================ Async Thunks ================ //

/**
 * Saves the delivery address to current user's profile.privateData.
 * The same address is used when the user sells (ship from) and buys (ship to).
 */
export const saveDeliveryAddressThunk = createAsyncThunk(
  'deliveryAddress/save',
  (deliveryAddress, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.currentUser
      .updateProfile(
        { privateData: { [DELIVERY_ADDRESS_KEY]: deliveryAddress } },
        {
          expand: true,
          include: ['profileImage'],
          'fields.image': ['variants.square-small', 'variants.square-small2x'],
        }
      )
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.updateProfile response');
        }
        dispatch(setCurrentUser(entities[0]));
        return entities[0];
      })
      .catch(e => {
        log.error(e, 'save-delivery-address-failed');
        return rejectWithValue(storableError(e));
      });
  }
);

// Backward compatible wrapper for the thunk
export const saveDeliveryAddress = deliveryAddress => dispatch =>
  dispatch(saveDeliveryAddressThunk(deliveryAddress)).unwrap();

// ================ Slice ================ //

const initialState = {
  saveDeliveryAddressInProgress: false,
  saveDeliveryAddressError: null,
};

const deliveryAddressSlice = createSlice({
  name: 'deliveryAddress',
  initialState,
  reducers: {
    clearSaveDeliveryAddressError: state => {
      state.saveDeliveryAddressError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(saveDeliveryAddressThunk.pending, state => {
        state.saveDeliveryAddressInProgress = true;
        state.saveDeliveryAddressError = null;
      })
      .addCase(saveDeliveryAddressThunk.fulfilled, state => {
        state.saveDeliveryAddressInProgress = false;
      })
      .addCase(saveDeliveryAddressThunk.rejected, (state, action) => {
        state.saveDeliveryAddressInProgress = false;
        state.saveDeliveryAddressError = action.payload;
      });
  },
});

export const { clearSaveDeliveryAddressError } = deliveryAddressSlice.actions;

export default deliveryAddressSlice.reducer;
