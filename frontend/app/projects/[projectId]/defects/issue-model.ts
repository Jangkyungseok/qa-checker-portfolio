export const STATES={NEW:'신규',REQUESTED:'요청',RE_REQUESTED:'재요청',IN_PROGRESS:'대응 중',RESPONDED:'대응 완료',VERIFIED:'수정 확인',SKIP_REQUESTED:'SKIP 요청',SKIP_CONFIRMED:'SKIP 확인'};
export const PRIORITIES={IMMEDIATE:'즉시',HIGH:'높음',NORMAL:'중간',LOW:'낮음'};
export const FREQUENCIES={PERCENT_100:'100%',PERCENT_70:'70%',PERCENT_50:'50%',PERCENT_30:'30%',PERCENT_1:'1%'};
export const LEGACY_FREQUENCIES={ALWAYS:'항상 (기존)',SOMETIMES:'간헐적 (기존)',RANDOM:'랜덤 (기존)',NOT_TESTED:'미확인 (기존)',UNABLE_TO_REPRODUCE:'재현 불가 (기존)',NOT_APPLICABLE:'해당 없음 (기존)'};
export const EVENTS:Record<string,string>={ATTACHMENT_ADDED:'증빙 추가',ATTACHMENT_REMOVED:'증빙 삭제',CREATED:'이슈 등록',STATUS_CHANGED:'상태 변경',ASSIGNEE_CHANGED:'담당자 변경 (기존)',SEVERITY_CHANGED:'영향도 변경 (기존)',PRIORITY_CHANGED:'우선순위 변경',CONTENT_UPDATED:'내용 변경',COMMENT_CREATED:'코멘트 작성',COMMENT_UPDATED:'코멘트 수정',COMMENT_DELETED:'코멘트 삭제'};
export const FIELDS:Record<string,string>={title:'제목',description:'이슈 내용',steps_to_reproduce:'재현 절차',fix_direction:'수정 방향',reproducibility:'발생 빈도',build_version:'빌드 버전',device_os:'발생 단말 / OS',related_defect_id:'연계 이슈',build_history_id:'연관 빌드 (기존)',inspection_id:'연관 검수 (기존)',expected_result:'기존 기대 결과',actual_result:'기존 실제 결과'};
export type Issue={id:string;project_id:string;defect_code:string;title:string;description:string;steps_to_reproduce:string;fix_direction:string|null;reproducibility:string;priority:string;status:keyof typeof STATES;created_by:string;created_by_name:string;updated_by_name:string;created_at:string;updated_at:string;version:number;build_version:string|null;device_os:string;related_defect_id:string|null;related_project_id:string|null;related_issue_code:string|null;related_issue_title:string|null;allowed_transitions:(keyof typeof STATES)[]};
export type Comment={id:string;author_id:string;author_name:string;body:string|null;created_at:string;updated_at:string;deleted_at:string|null;version:number};
export type Activity={id:string;actor_name:string;event_type:string;created_at:string;changes:Record<string,unknown>};
export type Request=<T>(path:string,options?:RequestInit)=>Promise<T>;
export function date(value:string){return new Date(value).toLocaleString('ko-KR');}
export function message(error:unknown){return error instanceof TypeError?'서버에 연결하지 못했습니다.':error instanceof Error?error.message:'요청을 처리하지 못했습니다.';}
export function display(value:unknown,map:Record<string,string>){
  const legacy:Record<string,string>={...LEGACY_FREQUENCIES,URGENT:'긴급 (기존)',MEDIUM:'보통 (기존)',OPEN:'등록 (기존)',FEEDBACK:'피드백 필요 (기존)',CONFIRMED:'확인 완료 (기존)',ASSIGNED:'담당 배정 (기존)',RESOLVED:'수정 완료 (기존)',RETEST:'재검수 (기존)',READY_FOR_RETEST:'재검수 대기 (기존)',CLOSED:'종료 (기존)'};
  return value==null?'미등록':map[String(value)]??legacy[String(value)]??String(value);
}
export function finalState(status:string){return ['VERIFIED','SKIP_CONFIRMED'].includes(status);}

export function issueCode(value:string|null|undefined){return value?.replace(/^BUG-/,'ISSUE-')??'';}
