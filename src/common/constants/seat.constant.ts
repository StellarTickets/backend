/**
 * Sentinel used throughout ticket issuance/purchase to mean "no seat
 * assignment" (general-admission tickets). Must never be a value a real
 * seat name can take, or a GA ticket and a seat literally named
 * "unassigned" become indistinguishable to `assertSeatAvailable`'s
 * uniqueness check.
 */
export const UNASSIGNED_SEAT = 'unassigned';
