/** What the close dialog explains before the customer confirms. */
export interface ClosePreview {
  collateralCents: bigint;
  appliedToDebtCents: bigint;
  returnedCents: bigint;
  heldCents: bigint;
}
