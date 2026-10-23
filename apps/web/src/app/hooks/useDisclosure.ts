import { useCallback, useState } from 'react';

/** Open/close state for dialogs (HeroUI v3 does not export one). */
export function useDisclosure(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const onOpenChange = useCallback((open: boolean) => setIsOpen(open), []);
  return { isOpen, onOpen, onClose, onOpenChange };
}
