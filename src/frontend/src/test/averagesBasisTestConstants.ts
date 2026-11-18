/**
 * Shared constants for the averages-basis control specs.
 *
 * Keeps the accessible name and the minimal ready-availability fixture
 * identical across the Class page, Student Averages card and heatmap specs.
 */

import type { BaselineAvailability } from '@/features/shared/baselineAvailability';

/** Accessible name of the shared mode control hosted in a card head. */
export const MODE_CONTROL_LABEL = 'Averages basis';

/** Minimal ready availability for the supplied-mode-props render. */
export const READY_AVAILABILITY: BaselineAvailability = { status: 'ready', reason: null };
