/* Offline authored template translations. User templates may use any BCP-47 language code. */
'use strict';
(()=>{
const packs={
'zh-Hans':{names:['个人简历','正式信函','会议记录','学习计划','项目报告'],name:'姓名',date:'日期',hint:'请在此处填写内容。',sections:[['个人简介','教育经历','工作经历','技能'],['收件人','主题','正文','签名'],['参会人员','议程','讨论内容','行动事项'],['学习目标','时间安排','学习资料','进度记录'],['项目概述','目标','工作成果','后续计划']]},
'zh-Hant':{names:['個人履歷','正式信函','會議紀錄','學習計畫','專案報告'],name:'姓名',date:'日期',hint:'請在此處填寫內容。',sections:[['個人簡介','教育經歷','工作經歷','技能'],['收件人','主旨','內文','簽名'],['與會人員','議程','討論內容','行動事項'],['學習目標','時間安排','學習資料','進度紀錄'],['專案概述','目標','工作成果','後續計畫']]},
ja:{names:['履歴書','正式な手紙','議事録','学習計画','プロジェクト報告書'],name:'氏名',date:'日付',hint:'ここに内容を入力してください。',sections:[['自己紹介','学歴','職歴','資格・技能'],['宛先','件名','本文','署名'],['出席者','議題','議事内容','対応事項'],['学習目標','スケジュール','教材','進捗記録'],['概要','目標','成果','今後の計画']]},
ko:{names:['이력서','공식 서신','회의록','학습 계획','프로젝트 보고서'],name:'이름',date:'날짜',hint:'여기에 내용을 입력하세요.',sections:[['자기소개','학력','경력','기술 및 자격'],['받는 사람','제목','본문','서명'],['참석자','안건','논의 내용','후속 조치'],['학습 목표','일정','학습 자료','진행 기록'],['개요','목표','성과','향후 계획']]},
ar:{names:['السيرة الذاتية','رسالة رسمية','محضر اجتماع','خطة دراسية','تقرير مشروع'],name:'الاسم',date:'التاريخ',hint:'اكتب المحتوى هنا.',sections:[['نبذة شخصية','التعليم','الخبرة العملية','المهارات'],['المرسل إليه','الموضوع','نص الرسالة','التوقيع'],['الحاضرون','جدول الأعمال','المناقشات','الإجراءات المطلوبة'],['أهداف التعلم','الجدول الزمني','المصادر التعليمية','سجل التقدم'],['نظرة عامة','الأهداف','النتائج','الخطوات التالية']]}
};
const E=FTEProCore.escape;
for(const [language,l]of Object.entries(packs))l.names.forEach((name,i)=>{
 const rtl=language==='ar',font=rtl?'Noto Sans Arabic':({ja:'Noto Sans JP',ko:'Noto Sans KR','zh-Hans':'Noto Sans SC','zh-Hant':'Noto Sans TC'}[language]),accent=['#76509a','#245a70','#386249','#874c3d','#344d79'][i];
 const attrs=`lang="${language}" dir="${rtl?'rtl':'ltr'}" style="font-family:${font};text-align:${rtl?'right':'left'}"`;
 let html=`<h1 ${attrs.replace('style="','style="color:white;background-color:'+accent+';border-bottom:6px solid #c49a63;padding:20px;font-size:26pt;margin-bottom:18px;')}>${E(name)}</h1><p ${attrs}>{{${l.name}}} · {{${l.date}}}</p>`;
 l.sections[i].forEach((section,j)=>{html+=`<h2 ${attrs.replace('style="','style="color:'+accent+';background-color:#f1f4f7;border-'+(rtl?'right':'left')+':4px solid #c49a63;padding:8px 12px;font-size:13pt;margin-top:18px;')}>${E(section)}</h2><p ${attrs}>${E(l.hint)}</p>`;if(i===2&&j===3)html+=`<table ${attrs}><tr><td>${E(l.name)}</td><td>${E(l.date)}</td></tr><tr><td><br></td><td><br></td></tr></table>`;});
 FTEProTemplates.push({id:`locale-${language}-${i}`,name,category:l.names[i],language,html});
});
})();
