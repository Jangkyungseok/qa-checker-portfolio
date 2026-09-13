'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppRouterContext, AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import styles from './decisions.module.css';

type Guard = { request: (action: () => void) => void; finish: (action: () => void) => void; setDirty: (value: boolean) => void };
const Context = createContext<Guard | null>(null);
export function useLeaveGuard() { return useContext(Context)!; }

export default function LeaveGuard({ children }: { children: ReactNode }) {
  const router = useContext(AppRouterContext)!;
  const dirty = useRef(false);
  const armed = useRef(false);
  const releaseAction = useRef<(() => void) | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const arm = useCallback(() => {
    if (armed.current) return;
    window.history.pushState({ ...window.history.state, issueFormGuard: true }, '', window.location.href);
    armed.current = true;
  }, []);
  const finish = useCallback((action: () => void) => {
    dirty.current = false;
    setPending(null);
    if (armed.current) {
      armed.current = false;
      releaseAction.current = action;
      window.history.back();
    } else if (releaseAction.current) {
      const previous = releaseAction.current;
      releaseAction.current = () => { previous(); action(); };
    } else action();
  }, []);
  const request = useCallback((action: () => void) => {
    if (dirty.current) setPending(() => action);
    else finish(action);
  }, [finish]);
  const setDirty = useCallback((value: boolean) => {
    if (dirty.current === value) return;
    dirty.current = value;
    if (value) arm();
    else finish(() => {});
  }, [arm, finish]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ''; }
    };
    const pop = (event: PopStateEvent) => {
      if (releaseAction.current) {
        event.stopImmediatePropagation();
        const action = releaseAction.current;
        releaseAction.current = null;
        action();
      } else if (armed.current && dirty.current) {
        // The guard entry is at the same URL as the form, so no route has been left yet.
        event.stopImmediatePropagation();
        armed.current = false;
        arm();
        setPending(() => () => window.history.back());
      }
    };
    const click = (event: MouseEvent) => {
      if (!dirty.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : (event.target as Node)?.parentElement;
      const link = target?.closest<HTMLAnchorElement>('a[href]');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      event.preventDefault();
      event.stopPropagation();
      request(() => {
        const url = new URL(link.href);
        if (url.origin === window.location.origin) router.push(url.pathname + url.search + url.hash);
        else window.location.assign(url.href);
      });
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', pop, true);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', pop, true);
      document.removeEventListener('click', click, true);
    };
  }, [arm, request, router]);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  const stay = () => { setPending(null); if (dirty.current) arm(); };
  const value = useMemo(() => ({ request, finish, setDirty }), [request, finish, setDirty]);
  // Next 16's useRouter reads this context. Intercept before dispatching a route
  // transition, rather than after history/URL changes have already committed.
  // Links dispatch separately in Next, so the capture listener above guards them.
  const guardedRouter = useMemo<AppRouterInstance>(() => ({
    ...router,
    push: (...args) => request(() => router.push(...args)),
    replace: (...args) => request(() => router.replace(...args)),
    back: () => request(() => router.back()),
    forward: () => request(() => router.forward()),
    refresh: () => request(() => router.refresh()),
    ...(router.experimental_gesturePush ? {
      experimental_gesturePush: (...args: Parameters<NonNullable<AppRouterInstance['experimental_gesturePush']>>) => request(() => router.experimental_gesturePush!(...args)),
    } : {}),
  }), [router, request]);
  return <Context.Provider value={value}><AppRouterContext.Provider value={guardedRouter}>{children}</AppRouterContext.Provider>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="leave-form-title" onCancel={event => { event.preventDefault(); stay(); }}>
      <div className={styles.form}>
        <h3 id="leave-form-title" className={styles.dialogTitle}>작성 중인 내용이 있습니다. 나가면 입력한 내용이 초기화됩니다. 계속할까요?</h3>
        <div className={styles.actions}>
          <button className="secondary-button" onClick={stay}>계속 작성</button>
          <button className="primary-button" onClick={() => { if (pending) finish(pending); }}>나가기</button>
        </div>
      </div>
    </dialog>
  </Context.Provider>;
}
