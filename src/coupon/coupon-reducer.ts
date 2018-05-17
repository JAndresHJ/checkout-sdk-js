import { combineReducers } from '@bigcommerce/data-store';

import { CheckoutAction, CheckoutActionType } from '../checkout';

import { CouponAction, CouponActionType } from './coupon-actions';
import CouponState, { CouponErrorsState, CouponStatusesState } from './coupon-state';
import InternalCoupon from './internal-coupon';

const DEFAULT_STATE: CouponState = {
    errors: {},
    statuses: {},
};

export default function couponReducer(state: CouponState = DEFAULT_STATE, action: CouponAction): CouponState {
    const reducer = combineReducers<CouponState>({
        data: dataReducer,
        errors: errorsReducer,
        statuses: statusesReducer,
    });

    return reducer(state, action);
}

function dataReducer(
    data: InternalCoupon[] | undefined,
    action: CheckoutAction | CouponAction
): InternalCoupon[] | undefined {
    switch (action.type) {
    case CheckoutActionType.LoadCheckoutSucceeded:
        return action.payload.coupons;

    default:
        return data;
    }
}

function errorsReducer(
    errors: CouponErrorsState = {},
    action: CouponAction
): CouponErrorsState {
    switch (action.type) {
    case CouponActionType.ApplyCouponRequested:
    case CouponActionType.ApplyCouponSucceeded:
        return { ...errors, applyCouponError: undefined };

    case CouponActionType.ApplyCouponFailed:
        return { ...errors, applyCouponError: action.payload };

    case CouponActionType.RemoveCouponRequested:
    case CouponActionType.RemoveCouponSucceeded:
        return { ...errors, removeCouponError: undefined };

    case CouponActionType.RemoveCouponFailed:
        return { ...errors, removeCouponError: action.payload };

    default:
        return errors;
    }
}

function statusesReducer(
    statuses: CouponStatusesState = {},
    action: CouponAction
): CouponStatusesState {
    switch (action.type) {
    case CouponActionType.ApplyCouponRequested:
        return { ...statuses, isApplyingCoupon: true };

    case CouponActionType.ApplyCouponSucceeded:
    case CouponActionType.ApplyCouponFailed:
        return { ...statuses, isApplyingCoupon: false };

    case CouponActionType.RemoveCouponRequested:
        return { ...statuses, isRemovingCoupon: true };

    case CouponActionType.RemoveCouponSucceeded:
    case CouponActionType.RemoveCouponFailed:
        return { ...statuses, isRemovingCoupon: false };

    default:
        return statuses;
    }
}
