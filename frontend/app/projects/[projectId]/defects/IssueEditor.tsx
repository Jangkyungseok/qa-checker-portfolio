'use client';
import {FormEvent,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useLeaveGuard} from '../decisions/LeaveGuard';
import {FREQUENCIES,PRIORITIES,STATES,Issue,Request,message} from './issue-model';
import styles from './defects.module.css';
import {EvidencePicker,EvidencePolicy,PendingEvidence,uploadEvidence} from './IssueEvidence';
type Values={title:string;stepsToReproduce:string;description:string;fixDirection:string;reproducibility:string;priority:string;buildVersion:string;deviceOs:string;relatedIssueCode:string};
const required:Partial<Record<keyof Values,string>>={title:'제목',stepsToReproduce:'재현 절차',description:'이슈 내용',fixDirection:'수정 방향',reproducibility:'발생 빈도',priority:'우선순위',buildVersion:'빌드 버전'};
function initial(r?:Issue):Values{return {title:r?.title??'',stepsToReproduce:r?.steps_to_reproduce??'',description:r?.description??'',fixDirection:r?.fix_direction??'',reproducibility:r&&r.reproducibility in FREQUENCIES?r.reproducibility:'',priority:r&&r.priority in PRIORITIES?r.priority:'',buildVersion:r?.build_version??'',deviceOs:r?.device_os??'공통',relatedIssueCode:(r?.related_issue_code??'').replace(/^(BUG|ISSUE)-/,'').replace(/^0+(?=\d)/,'')};}
export function Options({values}:{values:Record<string,string>}){return <>{Object.entries(values).map(([v,l])=><option key={v} value={v}>{l}</option>)}</>;}
export function Badge({status}:{status:keyof typeof STATES}){return <span className={`${styles.badge} ${styles[status]}`}>{STATES[status]}</span>;}
export default function IssueEditor({projectId,request,record,onSaved,onCancel}:{projectId:string;request:Request;record?:Issue;onSaved:(row:Issue)=>void;onCancel:()=>void}){
  const [values,setValues]=useState(()=>initial(record)),[errors,setErrors]=useState<Partial<Record<keyof Values,string>>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [files,setFiles]=useState<PendingEvidence[]>([]),[policy,setPolicy]=useState<EvidencePolicy|null>(null),[saved,setSaved]=useState<Issue|null>(null);
  useEffect(()=>{if(record)return;const c=new AbortController();request<EvidencePolicy>('/defects/attachment-policy',{signal:c.signal}).then(setPolicy).catch(e=>{if(!c.signal.aborted)setError(message(e));});return()=>c.abort();},[request,record]);
  const leave=useLeaveGuard(),form=useRef<HTMLFormElement>(null),dirty=JSON.stringify(values)!==JSON.stringify(initial(record))||files.some(x=>!x.done);
  useLayoutEffect(()=>{leave.setDirty(dirty);return()=>leave.setDirty(false);},[dirty,leave]);
  const change=(key:keyof Values,value:string)=>{setValues(v=>({...v,[key]:value}));setErrors(e=>({...e,[key]:undefined}));};
  async function submit(e:FormEvent){e.preventDefault();if(busy)return;const missing:Partial<Record<keyof Values,string>>={};for(const [key,label]of Object.entries(required))if(!values[key as keyof Values].trim())missing[key as keyof Values]=`${label}: ${['reproducibility','priority'].includes(key)?'선택':'입력'}해 주세요.`;
    if(values.relatedIssueCode.trim()&&!/^\d{1,18}$/.test(values.relatedIssueCode.trim()))missing.relatedIssueCode='연계 이슈 번호는 숫자만 입력해 주세요.';
    setErrors(missing);const first=Object.keys(missing)[0];if(first){(form.current?.elements.namedItem(first) as HTMLElement)?.focus();return;}
    setBusy(true);setError('');try{
      const row=saved??await request<Issue>(record?'/defects/'+record.id:'/defects',{method:record?'PATCH':'POST',body:JSON.stringify({...values,deviceOs:values.deviceOs.trim()||'공통',relatedIssueCode:values.relatedIssueCode.trim()?'ISSUE-'+values.relatedIssueCode.trim():null,...(record?{version:record.version}:{projectId})})});
      if(record){onSaved(row);return;}
      setSaved(row);const uploaded=await uploadEvidence(row.id,files,request,setFiles);
      if(uploaded.some(x=>!x.done)){setError('본문은 저장됐지만 일부 증빙 업로드가 실패했습니다. 아래 파일을 확인하고 다시 시도해 주세요.');return;}
      onSaved(await request<Issue>('/defects/'+row.id));
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }
  const feedback=(k:keyof Values)=>errors[k]?<small id={`${k}-error`} className={styles.fieldError}>{errors[k]}</small>:null;
  return <form ref={form} onSubmit={submit} noValidate className={`${styles.panel} ${styles.editor}`}><h2>{record?'이슈 수정':'이슈 등록'}</h2><p className={styles.hint}>* 필수 입력</p>{error&&<p className={styles.error} role="alert">{error}</p>}
    <fieldset className={styles.editorFields} disabled={busy||!!saved}><label>제목 *<input name="title" aria-label="제목 *" required maxLength={200} value={values.title} onChange={e=>change('title',e.target.value)} aria-invalid={!!errors.title} aria-describedby={errors.title?'title-error':undefined}/>{feedback('title')}</label>
    <div className={styles.contextFields}>
      <label>발생 빈도 *<select name="reproducibility" aria-label="발생 빈도 *" required value={values.reproducibility} onChange={e=>change('reproducibility',e.target.value)} aria-invalid={!!errors.reproducibility} aria-describedby={errors.reproducibility?'reproducibility-error':undefined}><option value="">선택해 주세요</option><Options values={FREQUENCIES}/></select>{feedback('reproducibility')}{record&&!(record.reproducibility in FREQUENCIES)&&<small className={styles.hint}>기존 기록은 발생 비율이 없어 새로 선택해야 합니다.</small>}</label>
      <label>우선순위 *<select name="priority" aria-label="우선순위 *" required value={values.priority} onChange={e=>change('priority',e.target.value)} aria-invalid={!!errors.priority} aria-describedby={errors.priority?'priority-error':undefined}><option value="">선택해 주세요</option><Options values={PRIORITIES}/></select>{feedback('priority')}</label>
      <label>빌드 버전 *<input name="buildVersion" aria-label="빌드 버전 *" required maxLength={200} placeholder="1.2.35.1042" value={values.buildVersion} onChange={e=>change('buildVersion',e.target.value)} aria-invalid={!!errors.buildVersion} aria-describedby={errors.buildVersion?'buildVersion-error':undefined}/>{feedback('buildVersion')}</label>
      <label>발생 단말 / OS<input name="deviceOs" maxLength={500} value={values.deviceOs} onChange={e=>change('deviceOs',e.target.value)}/></label>
      <label>연계 이슈 (선택)<span className={styles.issueNumberInput}><span aria-hidden="true">ISSUE-</span><input name="relatedIssueCode" aria-label="연계 이슈 (선택)" inputMode="numeric" pattern="[0-9]*" maxLength={18} placeholder="123" value={values.relatedIssueCode} onChange={e=>change('relatedIssueCode',e.target.value)} aria-invalid={!!errors.relatedIssueCode} aria-describedby={errors.relatedIssueCode?'relatedIssueCode-error':undefined}/></span>{feedback('relatedIssueCode')}</label>
    </div>
    {([['stepsToReproduce','재현 절차','재현 조건과 순서를 작성해 주세요.'],['description','이슈 내용','실제 발생 현상과 문제 내용을 작성해 주세요.'],['fixDirection','수정 방향','수정 방향과 확인 기준을 작성해 주세요.']] as const).map(([k,label,placeholder])=><label key={k}>{label} *<textarea name={k} aria-label={`${label} *`} required maxLength={10000} className={k==='description'?styles.description:k==='fixDirection'?styles.fixDirection:styles.narrative} placeholder={placeholder} value={values[k]} onChange={e=>change(k,e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k]?`${k}-error`:undefined}/>{feedback(k)}</label>)}
    </fieldset>
    {!record&&<EvidencePicker items={files} onChange={setFiles} policy={policy} disabled={busy}/>}
    {saved&&<p className={styles.hint}>본문은 이미 저장됐습니다. 파일별 업로드 결과를 확인해 주세요.</p>}
    <footer className={styles.formActions}><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>취소</button>{saved&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>onSaved(saved)}>저장된 이슈 보기</button>}<button className="primary-button" disabled={busy}>{busy?'저장 중...':saved?'첨부 다시 시도':record?'변경 저장':'이슈 등록'}</button></footer>
  </form>;
}
