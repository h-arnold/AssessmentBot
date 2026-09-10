import { App } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { setAuthenticationSettings } from '../../../services/authService/authService';
import type {
  AuthenticationSettings,
  AuthUserEntry,
} from '../../../services/authService/authService.zod';
import { getAuthenticationSettingsQueryOptions } from '../../../query/sharedQueries';

const genericLoadErrorMessage = 'Unable to load authentication settings right now.';
const genericSaveErrorMessage = 'Unable to save authentication settings right now.';
const rateLimitedErrorMessage = 'The service is busy. Please try again shortly.';
const staleRevisionWarningMessage =
  'Another administrator saved first. Review and re-save your changes.';
const lastAdminErrorMessage = 'At least one admin must remain. Review the user list and try again.';
const candidateCheckErrorMessage =
  'Your admin access is missing from the candidate list. Add yourself as an admin and try again.';
const saveSuccessMessage = 'Authentication settings saved.';

export type AuthMode = AuthenticationSettings['authMode'];
export type AuthUserRole = AuthUserEntry['role'];

type StagedUserListAction =
  | Readonly<{ type: 'add'; email: string; role: AuthUserRole }>
  | Readonly<{ type: 'remove'; email: string }>
  | Readonly<{ type: 'changeRole'; email: string; role: AuthUserRole }>
  | Readonly<{ type: 'seed'; users: ReadonlyArray<AuthUserEntry> }>;

type AuthenticationSettingsBaseline = Readonly<{
  authMode: AuthMode;
  authGroupEmail: string;
  authUsers: ReadonlyArray<AuthUserEntry>;
  authRevision: string | null;
}>;

/**
 * Normalises an auth user email: trim and lower-case, matching backend storage rules.
 *
 * @param {string} email The raw email value.
 * @returns {string} The normalised email.
 */
function normaliseAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure reducer for the staged authorised-user list in Script Properties mode.
 *
 * @param {ReadonlyArray<AuthUserEntry>} state The current staged list.
 * @param {StagedUserListAction} action The staged-list mutation.
 * @returns {ReadonlyArray<AuthUserEntry>} The next staged list.
 */
function authenticationUserListReducer(
  state: ReadonlyArray<AuthUserEntry>,
  action: StagedUserListAction
): ReadonlyArray<AuthUserEntry> {
  switch (action.type) {
    case 'add': {
      const normalisedEmail = normaliseAuthEmail(action.email);

      if (normalisedEmail === '') {
        return state;
      }

      if (state.some((user) => user.email === normalisedEmail)) {
        return state;
      }

      return [...state, { email: normalisedEmail, role: action.role }];
    }
    case 'remove': {
      const normalisedEmail = normaliseAuthEmail(action.email);

      return state.filter((user) => user.email !== normalisedEmail);
    }
    case 'changeRole': {
      const normalisedEmail = normaliseAuthEmail(action.email);

      return state.map((user) =>
        user.email === normalisedEmail ? { email: user.email, role: action.role } : user
      );
    }
    case 'seed': {
      return action.users.map((user) => ({ email: user.email, role: user.role }));
    }
    default: {
      return state;
    }
  }
}

/**
 * Maps an authentication-settings save failure into user-safe copy.
 *
 * @param {unknown} error The failure to map.
 * @returns {Readonly<{ message: string; isStaleRevision: boolean }>} User copy and stale flag.
 */
function mapAuthenticationSettingsSaveError(
  error: unknown
): Readonly<{ message: string; isStaleRevision: boolean }> {
  const rawMessage = error instanceof Error ? error.message : genericSaveErrorMessage;

  if (/stale|saved first/i.test(rawMessage)) {
    return { message: staleRevisionWarningMessage, isStaleRevision: true };
  }

  if (/last.?admin|admin must remain/i.test(rawMessage)) {
    return { message: lastAdminErrorMessage, isStaleRevision: false };
  }

  if (/candidate list/i.test(rawMessage)) {
    return { message: candidateCheckErrorMessage, isStaleRevision: false };
  }

  if (error instanceof ApiTransportError && error.code === 'RATE_LIMITED') {
    return { message: rateLimitedErrorMessage, isStaleRevision: false };
  }

  return { message: genericSaveErrorMessage, isStaleRevision: false };
}

/**
 * Builds the per-mode candidate save request for `setAuthenticationSettings`.
 *
 * @param {Readonly<{ authMode: AuthMode; authUsers: ReadonlyArray<AuthUserEntry>; authGroupEmail: string; authRevision: string | null; }>} dependencies Save request dependencies.
 * @returns {unknown} The mode-matched request payload.
 */
function buildAuthenticationSettingsSaveRequest(
  dependencies: Readonly<{
    authMode: AuthMode;
    authUsers: ReadonlyArray<AuthUserEntry>;
    authGroupEmail: string;
    authRevision: string | null;
  }>
): unknown {
  if (dependencies.authMode === 'scriptProperties') {
    return {
      authMode: 'scriptProperties',
      authUsers: dependencies.authUsers,
      ...(dependencies.authRevision === null
        ? {}
        : { expectedAuthRevision: dependencies.authRevision }),
    };
  }

  return {
    authMode: 'googleGroups',
    authGroupEmail: dependencies.authGroupEmail,
  };
}

export type AuthenticationSettingsHookValue = Readonly<{
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  stagedAuthMode: AuthMode | null;
  authGroupEmail: string;
  authUsers: ReadonlyArray<AuthUserEntry>;
  authRevision: string | null;
  isSaving: boolean;
  staleRevisionWarning: string | null;
  saveError: string | null;
  pendingModeSwitch: AuthMode | null;
  addUser: (rawEmail: string, role: AuthUserRole) => void;
  changeUserRole: (email: string, role: AuthUserRole) => void;
  removeUser: (email: string) => void;
  setAuthGroupEmail: (value: string) => void;
  requestModeSwitch: (targetMode: AuthMode) => void;
  confirmModeSwitch: () => void;
  cancelModeSwitch: () => void;
  save: () => Promise<void>;
}>;

/**
 * Orchestrates authentication-settings reads, staged edits, mode-switch staging, and saves.
 *
 * @remarks
 * The hook keeps all staged edits (auth mode, group email, and the authorised-user list) in
 * local React state so nothing is written until the administrator commits with the single Save
 * action. Staging is deliberate and non-instant: changing the mode Select does not change the
 * saved mode, it opens a confirmation modal; the visible regions only swap and the candidate
 * list seeds once the switch is confirmed. The authorised-user list uses a pure reducer
 * (`authenticationUserListReducer`) for add/remove/role-change, with email normalisation and a
 * duplicate guard applied at the boundary so no duplicate rows can ever be staged.
 *
 * A successful save rebases the staged list and revision from the commit result but performs no
 * query refetch, so the staged edits remain the single source of truth until the next load. A
 * stale-revision failure leaves the staged list and storage untouched and surfaces a persistent
 * warning, while last-admin and candidate-check failures surface in the status stack with the
 * form remaining usable.
 *
 * @returns {AuthenticationSettingsHookValue} The current authentication-settings orchestration state.
 */
export function useAuthenticationSettings(): AuthenticationSettingsHookValue {
  const { message } = App.useApp();
  const authenticationSettingsQuery = useQuery(getAuthenticationSettingsQueryOptions());

  const [stagedAuthMode, setStagedAuthMode] = useState<AuthMode | null>(null);
  const [authGroupEmail, setAuthGroupEmailState] = useState('');
  const [authUsers, dispatch] = useReducer(
    authenticationUserListReducer,
    [] as ReadonlyArray<AuthUserEntry>
  );
  const [authRevision, setAuthRevision] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [staleRevisionWarning, setStaleRevisionWarning] = useState<string | null>(null);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<AuthMode | null>(null);

  // Baseline snapshot used to seed the candidate list when a mode switch is confirmed.
  const baselineReference = useRef<AuthenticationSettingsBaseline | null>(null);
  const isGroupEmailCompulsoryReference = useRef(false);

  // Seeded-once flag: the staged values are initialised from the loaded settings exactly once.
  const hasSeededReference = useRef(false);

  const isInitialLoading = authenticationSettingsQuery.isPending;
  const isRefreshing =
    authenticationSettingsQuery.isFetching && !authenticationSettingsQuery.isPending;
  const loadError = authenticationSettingsQuery.isError ? genericLoadErrorMessage : null;

  const addUser = useCallback((rawEmail: string, role: AuthUserRole) => {
    dispatch({ type: 'add', email: rawEmail, role });
  }, []);

  const changeUserRole = useCallback((email: string, role: AuthUserRole) => {
    dispatch({ type: 'changeRole', email, role });
  }, []);

  const removeUser = useCallback((email: string) => {
    dispatch({ type: 'remove', email });
  }, []);

  const setAuthGroupEmail = useCallback((value: string) => {
    // Compulsory-once-set guard: a previously configured group email cannot be cleared.
    if (isGroupEmailCompulsoryReference.current && value.trim() === '') {
      return;
    }

    setAuthGroupEmailState(value);
  }, []);

  const requestModeSwitch = useCallback(
    (targetMode: AuthMode) => {
      if (stagedAuthMode === targetMode) {
        return;
      }

      setPendingModeSwitch(targetMode);
    },
    [stagedAuthMode]
  );

  const confirmModeSwitch = useCallback(() => {
    if (pendingModeSwitch === null || baselineReference.current === null) {
      return;
    }

    const targetMode = pendingModeSwitch;

    setStagedAuthMode(targetMode);

    if (targetMode === 'scriptProperties') {
      dispatch({ type: 'seed', users: baselineReference.current.authUsers });
    }

    setPendingModeSwitch(null);
  }, [pendingModeSwitch]);

  const cancelModeSwitch = useCallback(() => {
    setPendingModeSwitch(null);
  }, []);

  const save = useCallback(async (): Promise<void> => {
    if (
      isSaving ||
      loadError !== null ||
      stagedAuthMode === null ||
      baselineReference.current === null
    ) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setStaleRevisionWarning(null);

    try {
      const request = buildAuthenticationSettingsSaveRequest({
        authMode: stagedAuthMode,
        authUsers,
        authGroupEmail,
        authRevision,
      });
      const result = await setAuthenticationSettings(request);

      setAuthRevision(result.authRevision);
      baselineReference.current = {
        authMode: stagedAuthMode,
        authGroupEmail,
        authUsers,
        authRevision: result.authRevision,
      };
      message.success(saveSuccessMessage);
    } catch (error: unknown) {
      const mappedError = mapAuthenticationSettingsSaveError(error);

      if (mappedError.isStaleRevision) {
        setStaleRevisionWarning(mappedError.message);
      } else {
        setSaveError(mappedError.message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, loadError, stagedAuthMode, authUsers, authGroupEmail, authRevision, message]);

  // Seed the staged values from the loaded settings exactly once. The seeding side effects are
  // kept in a useEffectEvent so they run when the query resolves without tripping
  // react-hooks/set-state-in-effect, and a ref guard ensures it happens a single time.
  const seedFromSettings = useEffectEvent((settings: AuthenticationSettings): void => {
    baselineReference.current = {
      authMode: settings.authMode,
      authGroupEmail: settings.authGroupEmail,
      authUsers: settings.authUsers,
      authRevision: settings.authRevision,
    };
    isGroupEmailCompulsoryReference.current = settings.authGroupEmail.trim() !== '';

    setStagedAuthMode(settings.authMode);
    setAuthGroupEmailState(settings.authGroupEmail);
    dispatch({ type: 'seed', users: settings.authUsers });
    setAuthRevision(settings.authRevision);
  });

  useEffect(() => {
    if (authenticationSettingsQuery.data === undefined || hasSeededReference.current) {
      return;
    }

    hasSeededReference.current = true;
    seedFromSettings(authenticationSettingsQuery.data);
  }, [authenticationSettingsQuery.data]);

  return useMemo<AuthenticationSettingsHookValue>(
    () => ({
      isInitialLoading,
      isRefreshing,
      loadError,
      stagedAuthMode,
      authGroupEmail,
      authUsers,
      authRevision,
      isSaving,
      staleRevisionWarning,
      saveError,
      pendingModeSwitch,
      addUser,
      changeUserRole,
      removeUser,
      setAuthGroupEmail,
      requestModeSwitch,
      confirmModeSwitch,
      cancelModeSwitch,
      save,
    }),
    [
      isInitialLoading,
      isRefreshing,
      loadError,
      stagedAuthMode,
      authGroupEmail,
      authUsers,
      authRevision,
      isSaving,
      staleRevisionWarning,
      saveError,
      pendingModeSwitch,
      addUser,
      changeUserRole,
      removeUser,
      setAuthGroupEmail,
      requestModeSwitch,
      confirmModeSwitch,
      cancelModeSwitch,
      save,
    ]
  );
}
