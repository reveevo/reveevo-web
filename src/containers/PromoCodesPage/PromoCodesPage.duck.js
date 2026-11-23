import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { storableError } from '../../util/errors';
import {
  createAdminPromoCode,
  deleteAdminPromoCode,
  fetchAdminPromoCodeHistory,
  fetchAdminPromoCodes,
  updateAdminPromoCode,
} from '../../util/api';

// ================ Async Thunks ================ //

export const fetchPromoCodesThunk = createAsyncThunk(
  'PromoCodesPage/fetch',
  (_, { rejectWithValue }) =>
    fetchAdminPromoCodes()
      .then(response => response.data)
      .catch(e => rejectWithValue(storableError(e)))
);

export const createPromoCodeThunk = createAsyncThunk(
  'PromoCodesPage/create',
  (values, { rejectWithValue }) =>
    createAdminPromoCode(values)
      .then(response => response.data)
      .catch(e => rejectWithValue(storableError(e)))
);

export const updatePromoCodeThunk = createAsyncThunk(
  'PromoCodesPage/update',
  ({ id, values }, { rejectWithValue }) =>
    updateAdminPromoCode(id, values)
      .then(response => response.data)
      .catch(e => rejectWithValue(storableError(e)))
);

export const deletePromoCodeThunk = createAsyncThunk(
  'PromoCodesPage/delete',
  (id, { rejectWithValue }) =>
    deleteAdminPromoCode(id)
      .then(() => id)
      .catch(e => rejectWithValue(storableError(e)))
);

// The history of a code: uses, and uses given back when the order didn't go ahead
export const fetchPromoCodeHistoryThunk = createAsyncThunk(
  'PromoCodesPage/fetchHistory',
  (id, { rejectWithValue }) =>
    fetchAdminPromoCodeHistory(id)
      .then(response => ({ id, history: response.data.history || [] }))
      .catch(e => rejectWithValue(storableError(e)))
);

// ================ Slice ================ //

const initialState = {
  promoCodes: [],
  maxPercentage: null,
  currency: null,
  fetchInProgress: false,
  fetchError: null,
  createInProgress: false,
  createError: null,
  // The promo code being updated or deleted
  actionInProgressId: null,
  actionError: null,
  // Code id => { inProgress, error, entries }
  histories: {},
};

const promoCodesPageSlice = createSlice({
  name: 'PromoCodesPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchPromoCodesThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchPromoCodesThunk.fulfilled, (state, action) => {
        const { promoCodes, maxPercentage, currency } = action.payload || {};
        state.fetchInProgress = false;
        state.promoCodes = promoCodes || [];
        state.maxPercentage = maxPercentage ?? null;
        state.currency = currency || null;
      })
      .addCase(fetchPromoCodesThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload;
      })
      .addCase(createPromoCodeThunk.pending, state => {
        state.createInProgress = true;
        state.createError = null;
      })
      .addCase(createPromoCodeThunk.fulfilled, (state, action) => {
        state.createInProgress = false;
        state.promoCodes = [action.payload, ...state.promoCodes];
      })
      .addCase(createPromoCodeThunk.rejected, (state, action) => {
        state.createInProgress = false;
        state.createError = action.payload;
      })
      .addCase(updatePromoCodeThunk.pending, (state, action) => {
        state.actionInProgressId = action.meta.arg.id;
        state.actionError = null;
      })
      .addCase(updatePromoCodeThunk.fulfilled, (state, action) => {
        state.actionInProgressId = null;
        state.promoCodes = state.promoCodes.map(c =>
          c.id === action.payload.id ? action.payload : c
        );
      })
      .addCase(updatePromoCodeThunk.rejected, (state, action) => {
        state.actionInProgressId = null;
        state.actionError = action.payload;
      })
      .addCase(deletePromoCodeThunk.pending, (state, action) => {
        state.actionInProgressId = action.meta.arg;
        state.actionError = null;
      })
      .addCase(deletePromoCodeThunk.fulfilled, (state, action) => {
        state.actionInProgressId = null;
        state.promoCodes = state.promoCodes.filter(c => c.id !== action.payload);
      })
      .addCase(deletePromoCodeThunk.rejected, (state, action) => {
        state.actionInProgressId = null;
        state.actionError = action.payload;
      })
      .addCase(fetchPromoCodeHistoryThunk.pending, (state, action) => {
        const previous = state.histories[action.meta.arg] || {};
        state.histories[action.meta.arg] = { ...previous, inProgress: true, error: null };
      })
      .addCase(fetchPromoCodeHistoryThunk.fulfilled, (state, action) => {
        const { id, history } = action.payload;
        state.histories[id] = { inProgress: false, error: null, entries: history };
      })
      .addCase(fetchPromoCodeHistoryThunk.rejected, (state, action) => {
        const previous = state.histories[action.meta.arg] || {};
        state.histories[action.meta.arg] = {
          ...previous,
          inProgress: false,
          error: action.payload,
        };
      });
  },
});

export default promoCodesPageSlice.reducer;

// ================ Load data ================ //

// The list is fetched in the browser only (the admin check needs the user's session cookie,
// which the app's server has during SSR too, but the page is for admins only and not indexed).
export const loadData = () => dispatch =>
  typeof window === 'undefined' ? Promise.resolve() : dispatch(fetchPromoCodesThunk());
