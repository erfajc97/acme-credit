// The apps' dictionaries declare `satisfies Messages` from @acme/ui. The suite imports those
// dictionaries, not the UI kit: this shape stands in for the kit's type so the E2E program does not
// type-check the whole React package (tsconfig `paths`).
export interface Messages {
  [key: string]: string | Messages;
}
