import { createContext, useContext } from 'react';

type ClassSelectionContextValue = Readonly<{
  /** The currently selected class ID, or null when viewing the class list. */
  selectedClassId: string | null;
  /** The class name of the currently selected class, or null when viewing the class list. */
  className: string | null;
  /** Select a class detail view by ID and name. */
  onSelectClass: (classId: string, className: string) => void;
  /** Navigate back to the class list (clears selection). */
  onNavigateToClasses: () => void;
}>;

/**
 * Provides class-selection state and navigation callbacks shared between
 * the shell breadcrumb and the ClassesPage/ClassPage feature subtree.
 *
 * @remarks
 * Owned by `AppShell`. Consumed by `ClassesPage` and `ClassPage` to avoid
 * prop-drilling selection state through the pure `renderNavigationPage` contract.
 */
export const ClassSelectionContext = createContext<ClassSelectionContextValue>({
  selectedClassId: null,
  className: null,
  onSelectClass: () => {
    throw new TypeError('ClassSelectionContext.onSelectClass called without a provider');
  },
  onNavigateToClasses: () => {
    throw new TypeError('ClassSelectionContext.onNavigateToClasses called without a provider');
  },
});

/**
 * Consumes the class-selection context.
 *
 * @returns {ClassSelectionContextValue} The current class selection state and callbacks.
 */
export function useClassSelection(): ClassSelectionContextValue {
  return useContext(ClassSelectionContext);
}
