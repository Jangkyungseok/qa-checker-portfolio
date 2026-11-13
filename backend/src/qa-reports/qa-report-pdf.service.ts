import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import sharp = require('sharp');
import { join } from 'node:path';
import { DefectAttachmentsService } from '../defects/defect-attachments.service';
import { STATES, PRIORITIES, FREQUENCIES } from '../defects/issue-labels';
import { QaReportsService } from './qa-reports.service';

export const CONSIDERATIONS:Record<string,string>={REQUIRED_CONSIDERATION:'필수 대응 고려',PRIORITY_CONSIDERATION:'우선 대응 고려',FUTURE_CONSIDERATION:'추후 개선 고려',NEEDS_REVIEW:'추가 확인 필요'};
const kst=(v:string)=>new Date(new Date(v).getTime()+9*3600000).toISOString().slice(0,19).replace('T',' ');
@Injectable()
export class QaReportPdfService {
  private busy=false;
  constructor(private readonly reports:QaReportsService,private readonly attachments:DefectAttachmentsService) {}
  async generate(projectId:string,id:string,version:number) {
    if(this.busy)throw new ServiceUnavailableException('다른 PDF를 생성하고 있습니다. 잠시 후 다시 시도해 주세요.');
    this.busy=true;
    try {
      const data=await this.reports.pdfData(projectId,id,version);
      const images=new Map<string,Buffer>();
      for(const issue of data.featured)if(issue.image){
        const file=await this.attachments.file(issue.id,issue.image.id);
        if(file.data.length>5*1024*1024)throw new ServiceUnavailableException('증빙 이미지 크기가 PDF 처리 한도를 초과했습니다.');
        try{images.set(issue.id,await sharp(file.data,{limitInputPixels:20000000}).rotate().resize({width:1400,height:1100,fit:'inside',withoutEnlargement:true}).png().toBuffer());}
        catch {throw new ServiceUnavailableException('증빙 이미지를 읽을 수 없습니다. 첨부파일을 확인해 주세요.');}
      }
      const {report:r,summary:s,featured}=data;
      const doc=new PDFDocument({size:'A4',layout:'landscape',margins:{top:32,bottom:48,left:42,right:42},bufferPages:true,info:{Title:r.title,Author:'QA Checker',Subject:'QA 결과 리포트'}});
      doc.registerFont('KR',join(__dirname,'fonts/NotoSansCJKkr-Regular.otf'));
      doc.registerFont('KR-Bold',join(__dirname,'fonts/NotoSansCJKkr-Bold.otf'));
      doc.font('KR').fontSize(10).fillColor('#20344d');
      const chunks:Buffer[]=[];
      const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',x=>chunks.push(x));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
      const width=doc.page.width-84;
      const ensure=(h:number)=>{if(doc.y+h>doc.page.height-62)doc.addPage();};
      const text=(value:string,size=10,bold=false)=>{doc.font(bold?'KR-Bold':'KR').fontSize(size).fillColor('#20344d').text(value||'',42,doc.y,{width,lineGap:3});doc.moveDown(0.2);};
      const section=(title:string,spacing=0.35)=>{ensure(64);doc.moveDown(spacing);text(title,14,true);};
      // The executive summary uses measured, bounded panels on a single page.
      const ink='#20344d',muted='#68788b';
      const at=(value:string,x:number,y:number,w:number,size=9,bold=false,color=ink)=>{
        doc.font(bold?'KR-Bold':'KR').fontSize(size).fillColor(color).text(value,x,y,{width:w,lineGap:1});
      };
      const overviewOverflow:{label:string;value:string}[]=[];
      const compact=(value:string,x:number,y:number,w:number,h:number,label?:string)=>{
        const original=value;value=value.replace(/\s*\n\s*/g,' / ');
        let size=9;doc.font('KR').fontSize(size);
        while(size>8&&doc.heightOfString(value,{width:w,lineGap:1})>h){size-=0.5;doc.fontSize(size);}
        if(doc.heightOfString(value,{width:w,lineGap:1})>h){
          if(label)overviewOverflow.push({label,value:original});
          doc.fillColor(ink).text(value,x,y,{width:w,height:h,ellipsis:true,lineGap:1});
        }else at(value,x,y,w,size);
      };
      at('GAME QUALITY ASSURANCE',42,25,width,8,true,muted);
      at('QA 결과 리포트',42,39,300,22,true);
      compact(r.title,360,44,width-318,26);
      compact(`${r.project_name} / ${r.target_build} / ${r.test_start_date} ~ ${r.test_end_date}`,42,72,width,18);
      at(`생성일 ${kst(s.generatedAt)} (한국시간)`,42,91,width,8,false,muted);
      at('01 테스트 개요',42,113,width,12,true);
      const overview=[['프로젝트명',r.project_name],['대상 빌드',r.target_build],['테스트 범위',r.test_scope],['테스트 환경',r.test_environment],['테스트 기간',`${r.test_start_date} ~ ${r.test_end_date}`],['테스트 방식',r.test_method]];
      const half=width/2;
      for(let i=0;i<overview.length;i++){
        const [label,value]=overview[i],x=42+(i%2)*half,y=135+Math.floor(i/2)*30;
        doc.rect(x,y,half,30).fillAndStroke('#f8fafc','#dce4ed');
        at(label,x+9,y+9,65,8,true,muted);
        compact(value,x+81,y+5,half-91,23,label);
      }
      at('02 이슈 요약',42,237,width,12,true);
      const kpis=[['전체 이슈',s.totals.total],['미처리',s.totals.pending],['대응 중',s.totals.inProgress],['대응 완료',s.totals.responded],['수정 확인',s.totals.verified],['SKIP',s.totals.skip],['처리율',s.completion.rate+'%']];
      kpis.forEach(([label,value],i)=>{const x=42+i*width/7,w=width/7-7;doc.roundedRect(x,259,w,48,4).fill('#eef5fc');at(String(label),x+9,265,w-18,8);at(String(value),x+9,278,w-18,18,true);});
      at('03 이슈 현황',42,319,width,12,true);
      const colors:Record<string,string>={NEW:'#eef1f4',REQUESTED:'#fde4e4',RE_REQUESTED:'#f5bfc5',IN_PROGRESS:'#fff6ce',RESPONDED:'#dceee4',VERIFIED:'#e4e7eb',SKIP_REQUESTED:'#eed27d',SKIP_CONFIRMED:'#e4e7eb'};
      const leftWidth=width*0.47,rightX=42+width*0.51,rightWidth=width*0.49;
      at('상태별 현황',42,342,leftWidth,9,true);
      ['NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED'].forEach((key,i)=>{
        const count=Number(s.byStatus[key]??0),y=361+i*17;
        at(STATES[key]??key,42,y,72,8);
        doc.roundedRect(122,y+2,leftWidth-112,9,2).fill('#f5f7fa');
        if(count)doc.roundedRect(122,y+2,Math.max(2,count/Math.max(s.totals.total,1)*(leftWidth-112)),9,2).fill(colors[key]);
        at(`${count}건`,42+leftWidth-29,y,29,8);
      });
      at('우선순위',rightX,342,rightWidth,9,true);
      at(['IMMEDIATE','HIGH','NORMAL','LOW',...Object.keys(s.byPriority).filter(k=>!['IMMEDIATE','HIGH','NORMAL','LOW'].includes(k))].map(k=>`${PRIORITIES[k]??'미등록'} ${s.byPriority[k]??0}건`).join('   '),rightX,358,rightWidth,8);
      at('발생 빈도',rightX,385,rightWidth,9,true);
      at(Object.entries(s.byFrequency).map(([k,v])=>`${FREQUENCIES[k]??'미등록'} ${v}건`).join('   '),rightX,401,rightWidth,8);
      at('재요청 / SKIP',rightX,439,rightWidth,9,true);
      at(`재요청: 현재 ${s.rerequest.current}건 / 발생 이슈 ${s.rerequest.affectedIssues}건 / 총 ${s.rerequest.totalTransitions}회`,rightX,456,rightWidth,8);
      at(`SKIP: 요청 ${s.skip.requested}건 / 확인 ${s.skip.confirmed}건 / 확인 비율 ${s.skip.rate}%`,rightX,474,rightWidth,8);
      at('집계 기준: 한국시간 테스트 시작일 00:00 이상, 종료일 다음 날 00:00 미만에 등록된 이슈의 현재 상태. 기간 전 등록 이슈의 기간 내 활동은 제외합니다.',42,513,width,7,false,muted);
      at(`집계 빌드: ${r.filter_build_version??'전체 빌드'} / 조회 기준: ${kst(s.generatedAt)}${overviewOverflow.length?' / 긴 개요 항목은 다음 페이지에 전문 수록':''}`,42,528,width,7,false,muted);
      doc.addPage();
      // Preserve the full stored overview when it cannot fit in a summary cell.
      if(overviewOverflow.length){section('테스트 개요 상세');for(const item of overviewOverflow){ensure(64);text(item.label,10,true);text(item.value);}}
      section('04 대표 이슈');
      if(!featured.length)text('선택한 대표 이슈 없음');
      for(let i=0;i<featured.length;i++){
        const issue=featured[i],image=images.get(issue.id);
        const metadata=image?await sharp(image).metadata():null;
        const scale=metadata?Math.min(width/metadata.width!,245/metadata.height!,1):0;
        const imageHeight=metadata?metadata.height!*scale:0;
        doc.font('KR').fontSize(10);
        const bodyHeight=doc.heightOfString(issue.steps_to_reproduce+'\n'+issue.description,{width,lineGap:3});
        const blockHeight=bodyHeight+imageHeight+180;
        ensure(blockHeight<doc.page.height-doc.page.margins.top-62?blockHeight:100);text(`${i+1}. ${issue.issue_code}  ${issue.title}`,12,true);
        text(`우선순위 ${PRIORITIES[issue.priority]??'미등록'} / 발생 빈도 ${FREQUENCIES[issue.reproducibility]??'미등록'} / 발생 단말 · OS ${issue.device_os}`);
        ensure(64);text('재현 절차',10,true);text(issue.steps_to_reproduce);ensure(64);text('이슈 내용',10,true);text(issue.description);
        if(image&&metadata){const h=imageHeight,w=metadata.width!*scale;ensure(h+25);doc.image(image,42,doc.y,{width:w,height:h});doc.y+=h+12;}
        else text('증빙 이미지 없음',9);
        if(issue.video)text('영상 증빙 있음',9,true);
      }
      doc.font('KR').fontSize(9);
      const closingRows=Object.entries(CONSIDERATIONS).map(([purpose,label])=>{
        const links=r.links.filter((x:any)=>x.purpose===purpose);
        return Math.max(doc.heightOfString(links.length?(r.considerations[purpose]||'별도 내용 없음'):'해당 없음',{width:width-262,lineGap:3}),links.length*14,14)+12;
      });
      doc.font('KR').fontSize(10);
      const closingHeight=closingRows.reduce((a,b)=>a+b,0)+doc.heightOfString(r.lead_opinion,{width,lineGap:3})+90;
      if(closingHeight<doc.page.height-doc.page.margins.top-62)ensure(closingHeight);
      section('05 QA 대응 고려사항',0.15);
      const hasConsiderations=Object.keys(CONSIDERATIONS).some(p=>r.considerations[p]?.trim()||r.links.some((x:any)=>x.purpose===p));
      if(!hasConsiderations)text('별도 고려사항 없음');
      else {
        const widths=[100,35,115,width-250],lineHeight=14;
        const wrap=(value:string,w:number)=>{doc.font('KR').fontSize(9);const lines:string[]=[];for(const paragraph of value.split('\n')){let line='';for(const char of paragraph){if(doc.widthOfString(line+char)>w-12&&line){lines.push(line);line='';}line+=char;}lines.push(line);}return lines;};
        const drawCells=(cells:string[][],count:number,header=false)=>{const y=doc.y,h=count*lineHeight+12;let x=42;cells.forEach((lines,i)=>{doc.rect(x,y,widths[i],h).fillAndStroke(header?'#eef5fc':'#ffffff','#dce4ed');doc.font(header?'KR-Bold':'KR').fontSize(9).fillColor('#20344d');lines.forEach((line,n)=>doc.text(line,x+6,y+6+n*lineHeight,{width:widths[i]-12,lineBreak:false}));x+=widths[i];});doc.y=y+h;};
        const header=()=>{ensure(45);drawCells([['구분'],['건수'],['관련 ISSUE'],['주요 내용']],1,true);};header();
        for(const [purpose,label] of Object.entries(CONSIDERATIONS)){
          const links=r.links.filter((x:any)=>x.purpose===purpose);
          const cells=[label,String(links.length),links.map((x:any)=>x.issue_code).join('\n')||'없음',links.length?(r.considerations[purpose]||'별도 내용 없음'):'해당 없음'].map((value,i)=>wrap(value,widths[i]));
          let offset=0,total=Math.max(...cells.map(x=>x.length));
          while(offset<total){let capacity=Math.floor((doc.page.height-62-doc.y-12)/lineHeight);if(capacity<1){doc.addPage();header();capacity=Math.floor((doc.page.height-62-doc.y-12)/lineHeight);}const count=Math.min(capacity,total-offset);drawCells(cells.map(x=>x.slice(offset,offset+count)),count);offset+=count;}
        }
        doc.moveDown(0.2);
      }
      section('06 QA 리드 최종 의견',0.15);text(r.lead_opinion);
      const pages=doc.bufferedPageRange();
      for(let i=0;i<pages.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('KR').fontSize(8).fillColor('#68788b').text(`QA Checker  |  ${kst(s.generatedAt).slice(0,10)}  |  Page ${i+1} / ${pages.count}`,42,doc.page.height-34,{width,align:'right',lineBreak:false});doc.page.margins.bottom=bottom;}
      doc.end();
      const buffer=await done;
      const name=r.title.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'').replace(/[. ]+$/g,'').slice(0,60)||'QA 결과 리포트';
      return {buffer,filename:`QA_Checker_${name}_${kst(s.generatedAt).slice(0,10).replace(/-/g,'')}.pdf`};
    } finally {this.busy=false;}
  }
}
