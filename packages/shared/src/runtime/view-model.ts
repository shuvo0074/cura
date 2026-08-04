import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * MVVM foundation.
 *
 * A ViewModel is a plain TypeScript class holding state and behaviour. It has
 * no React import, no JSX and no DOM access, which means:
 *  - Views are pure functions of ViewModel state.
 *  - ViewModels are unit-testable without a renderer.
 *  - The same ViewModel logic can be shared with React Native.
 *
 * Change propagation uses `useSyncExternalStore`, so React reads state through
 * the concurrent-safe subscription path rather than a re-render side effect.
 */
export abstract class ViewModel<TState> {
  private listeners = new Set<() => void>();
  private currentState: TState;
  private disposed = false;

  protected constructor(initialState: TState) {
    this.currentState = initialState;
  }

  get state(): TState {
    return this.currentState;
  }

  /**
   * Whether `dispose()` has run.
   *
   * Async ViewModel methods check this after every `await` before calling
   * `setState`, so a request that resolves after the View unmounted is dropped
   * instead of updating a dead instance.
   *
   * Public because `useViewModel` needs it: React StrictMode disposes an
   * instance during its development remount cycle, and the hook must notice
   * and replace it.
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Applies a partial update and notifies subscribers.
   *
   * Reference equality is checked field-by-field so a no-op update does not
   * schedule a render — this is what keeps high-frequency sources (websocket
   * queue counters, typeahead keystrokes) from thrashing the tree.
   */
  protected setState(patch: Partial<TState> | ((prev: TState) => Partial<TState>)): void {
    if (this.disposed) return;

    const delta = typeof patch === 'function' ? patch(this.currentState) : patch;
    let changed = false;
    for (const key of Object.keys(delta) as Array<keyof TState>) {
      if (!Object.is(this.currentState[key], delta[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    this.currentState = { ...this.currentState, ...delta };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): TState => this.currentState;

  /** Called when the last View detaches. Override to cancel timers/sockets. */
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}

/**
 * The read side of a ViewModel.
 *
 * Used as the hook's generic constraint. `ViewModel<T>` itself is invariant in
 * `T` (it holds a private `T` field), so constraining against the class would
 * reject every concrete subclass. This interface mentions `TState` only in
 * return position, which makes it covariant and lets inference work.
 */
export interface ObservableState<TState> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TState;
  dispose(): void;
  readonly isDisposed: boolean;
}

/** Extracts the state type a ViewModel exposes. */
export type StateOf<TViewModel> = TViewModel extends ObservableState<infer TState>
  ? TState
  : never;

/**
 * Binds a ViewModel instance to a component.
 *
 * The state type is derived from the ViewModel via `StateOf`, so call sites
 * write `useViewModel(() => new LoginViewModel(...))` with no explicit type
 * arguments and still get a fully typed state object.
 *
 * The factory runs once per mount; `dispose()` runs on unmount so subscriptions
 * and in-flight work are always released.
 */
export function useViewModel<TViewModel extends ObservableState<unknown>>(
  factory: () => TViewModel,
): [StateOf<TViewModel>, TViewModel] {
  // Held in a ref so the identity is stable across renders without making the
  // factory a dependency — callers write `() => new XViewModel(deps)` inline,
  // which is a new function every render.
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  const [vm, setVm] = useState<TViewModel>(factory);

  useEffect(() => {
    /**
     * React StrictMode mounts, unmounts and remounts every component once in
     * development. That unmount runs the cleanup below and disposes this
     * instance — and a disposed ViewModel silently swallows every subsequent
     * `setState`, which presents as a form whose fields will not accept input.
     *
     * So on re-entry we check first: if this instance is already dead, replace
     * it rather than subscribing to a corpse.
     */
    if (vm.isDisposed) {
      setVm(() => factoryRef.current());
      return;
    }

    return () => {
      vm.dispose();
    };
  }, [vm]);

  const state = useSyncExternalStore(
    vm.subscribe,
    vm.getSnapshot,
    vm.getSnapshot,
  ) as StateOf<TViewModel>;

  return [state, vm];
}

/**
 * Selector subscription.
 *
 * A View that needs one slice of a large ViewModel re-renders only when that
 * slice changes, which keeps the calendar grid from repainting because an
 * unrelated counter moved.
 */
export function useViewModelSelector<TState, TSelected>(
  vm: ViewModel<TState>,
  selector: (state: TState) => TSelected,
  isEqual: (a: TSelected, b: TSelected) => boolean = Object.is,
): TSelected {
  const lastRef = useRef<{ value: TSelected } | null>(null);

  const getSelection = useCallback((): TSelected => {
    const next = selector(vm.getSnapshot());
    if (lastRef.current && isEqual(lastRef.current.value, next)) {
      return lastRef.current.value;
    }
    lastRef.current = { value: next };
    return next;
  }, [vm, selector, isEqual]);

  return useSyncExternalStore(vm.subscribe, getSelection, getSelection);
}

/** Standard async slice shared by list/detail ViewModels. */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const idleAsync = <T>(): AsyncState<T> => ({ data: null, loading: false, error: null });
