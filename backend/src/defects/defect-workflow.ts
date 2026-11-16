export const FINAL_STATES=['VERIFIED','SKIP_CONFIRMED'];
export const TRANSITIONS:Record<string,readonly string[]>={
  NEW:['REQUESTED','SKIP_REQUESTED'],
  REQUESTED:['IN_PROGRESS','SKIP_REQUESTED'],
  RE_REQUESTED:['IN_PROGRESS','SKIP_REQUESTED'],
  IN_PROGRESS:['RESPONDED','SKIP_REQUESTED'],
  RESPONDED:['VERIFIED','RE_REQUESTED'],
  VERIFIED:['RE_REQUESTED'],
  SKIP_REQUESTED:['SKIP_CONFIRMED','IN_PROGRESS'],
  SKIP_CONFIRMED:['RE_REQUESTED'],
};
// Approved users can exchange progress without assignment. Final QA confirmation/reopen is managerial.
export function allowedTransitions(row:{status:string},user:{role:string}) {
  if(user.role==='DEV') {
    const developer:Record<string,readonly string[]>={
      REQUESTED:['IN_PROGRESS'], RE_REQUESTED:['IN_PROGRESS'],
      IN_PROGRESS:['RESPONDED'], SKIP_REQUESTED:['IN_PROGRESS'],
    };
    return [...(developer[row.status]??[])];
  }
  const next=[...(TRANSITIONS[row.status]??[])];
  if(user.role!=='USER')return next;
  if(FINAL_STATES.includes(row.status))return [];
  return next.filter(s=>!FINAL_STATES.includes(s));
}
