/**
 * Trường học 5.0 — máy chủ dữ liệu Apps Script.
 * Dữ liệu lưu trong Drive và Google Sheets thuộc tài khoản triển khai.
 */
const ADMIN_ACCOUNT = 'admin@truonghoc5.local';
const ADMIN_PASSWORD_HASH = 'BAN_BAM_MAT_KHAU_ADMIN';
const TH50 = Object.freeze({
  ADMIN: 'hcmtranle@gmail.com',
  ROOT: 'Trường học 5.0',
  TZ: 'Asia/Ho_Chi_Minh',
  TOKEN_HOURS: 720, // 30 ngày trên cùng thiết bị, để mỗi người chỉ cần mã email khoảng một lần mỗi tháng
  CODE_MINUTES: 10,
  RETENTION_DAYS: 365
});

function doGet(e) {
  const trang=dvTrang_(e);if(trang)return trang;
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Trường học 5.0')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


function adminLogin(password) {
  if (digest_(String(password || '')) !== ADMIN_PASSWORD_HASH) throw new Error('Mật khẩu Admin không đúng.');
  const db=db_(); let user=read_(db,'Users').find(r=>r.email===ADMIN_ACCOUNT||r.role==='ADMIN');
  if(user&&user.email!==ADMIN_ACCOUNT)user=updateWhere_(db,'Users',r=>r.id===user.id,r=>{r.email=ADMIN_ACCOUNT;return r;});
  if(!user){user={id:Utilities.getUuid(),email:ADMIN_ACCOUNT,name:'Trần Thị Thu Hương',phone:'',role:'ADMIN',status:'APPROVED',createdAt:now_(),approvedAt:now_(),approvedBy:ADMIN_ACCOUNT,personalFolderId:'',features:'all'};append_(db,'Users',user);}
  return {token:issueToken_(user),user:publicUser_(user)};
}
function pendingKey_(email){return 'pendingReg:'+digest_(email)}
function registerUser(input){
 input=input||{};const email=cleanEmail_(input.email),name=cleanText_(input.name,100),phone=cleanText_(input.phone,25),requestedRole=['LEADER','TEACHER'].indexOf(input.requestedRole)>=0?input.requestedRole:'TEACHER';
 if(!email||!name||!phone)throw new Error('Vui lòng nhập đủ họ tên, email và số điện thoại.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email chưa đúng định dạng.');
 const db=db_();ensureCollabSheets_(db);const requestedTeamId=cleanText_(input.teamId,80)||toMacDinh_();if(dvTruong_()&&!read_(db,'Teams').some(t=>t.id===requestedTeamId&&asBool_(t.active)))throw new Error('Vui lòng chọn tổ chuyên môn của thầy/cô.');let existing=read_(db,'Users').find(r=>r.email===email);if(existing&&existing.role==='ADMIN'){updateWhere_(db,'Users',r=>r.id===existing.id,r=>{r.email=ADMIN_ACCOUNT;return r;});existing=null;}
 if(existing){if(existing.status==='APPROVED')return {status:'APPROVED',message:'Tài khoản đã được duyệt. Cô/thầy có thể đăng nhập.'};if(existing.status==='DISABLED')return {status:'DISABLED',message:'Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.'};if(String(existing.status).toUpperCase()==='PENDING')P_().setProperty(pendingKey_(email),JSON.stringify(existing));return {status:existing.status,message:'Yêu cầu đã được gửi và đang chờ quản trị viên duyệt.'};}
 const item={id:Utilities.getUuid(),email:email,name:name,phone:phone,role:'TEACHER',requestedRole:requestedRole,status:'PENDING',createdAt:now_(),approvedAt:'',approvedBy:'',personalFolderId:'',activationHash:'',activationExpiry:'',features:'notebooks,minutes,meetings',teamId:requestedTeamId};
 P_().setProperty(pendingKey_(email),JSON.stringify(item));append_(db,'Users',item);SpreadsheetApp.flush();
 try{MailApp.sendEmail({to:email,subject:'Đã nhận đăng ký — Trường học 5.0',htmlBody:'<p>Xin chào '+escapeHtml_(name)+',</p><p>Hệ thống đã nhận đăng ký của cô/thầy. Hồ sơ đang chờ quản trị viên duyệt.</p><p>Sau khi được duyệt, hệ thống sẽ gửi email thứ hai kèm mã kích hoạt tài khoản.</p>',name:'Trường học 5.0'});}catch(e){}
 return {status:'PENDING',message:'Đã gửi đăng ký đến quản trị viên. Hệ thống đã gửi email xác nhận tiếp nhận nếu hộp thư cho phép.'};
}
function adminApprovals(token){requireRole_(token,['ADMIN']);const db=db_(),byEmail={};read_(db,'Users').filter(u=>String(u.status||'').trim().toUpperCase()==='PENDING').forEach(u=>byEmail[u.email]=u);const p=P_(),all=p.getProperties();Object.keys(all).filter(k=>k.indexOf('pendingReg:')===0).forEach(k=>{try{const u=JSON.parse(all[k]);if(u&&u.email)byEmail[u.email]=Object.assign({},u,byEmail[u.email]||{})}catch(e){}});return {items:Object.keys(byEmail).map(k=>byEmail[k]).map(u=>({email:u.email,name:u.name,phone:u.phone,requestedRole:u.requestedRole,status:u.status,teamId:u.teamId||'',createdAt:u.createdAt})),teams:ensureCollabSheets_(db).filter(t=>asBool_(t.active)).map(t=>({id:t.id,name:t.name}))};}
function adminUsers(token){requireRole_(token,['ADMIN']);return {items:read_(db_(),'Users').filter(u=>u.role!=='ADMIN').map(publicUser_)}}
function setUserStatus(token,email,status){
  const admin=requireRole_(token,['ADMIN']),db=db_();email=cleanEmail_(email);status=status==='DISABLED'?'DISABLED':'APPROVED';
  const u=updateWhere_(db,'Users',r=>r.email===email&&r.role!=='ADMIN',r=>Object.assign(r,{status:status,statusChangedAt:now_(),statusChangedBy:admin.email}));
  if(!u)throw new Error('Không tìm thấy tài khoản người dùng.');
  if(status==='DISABLED'){const p=P_(),all=p.getProperties();Object.keys(all).filter(k=>k.indexOf('session:')===0).forEach(k=>{try{if(JSON.parse(all[k]).email===email)p.deleteProperty(k)}catch(e){}})}
  audit_(db,admin,status==='DISABLED'?'DISABLE_USER':'RESTORE_USER',email);return publicUser_(u);
}
function requestAccessCode(email){
  email=cleanEmail_(email);if(!email)throw new Error('Vui lòng nhập email.');const db=db_(),user=read_(db,'Users').find(r=>r.email===email);
  if(!user||user.status!=='APPROVED')throw new Error(user&&user.status==='DISABLED'?'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.':'Tài khoản chưa được kích hoạt hoặc chưa được duyệt.');
  const cache=CacheService.getScriptCache(),key='login:'+digest_(email);if(cache.get(key))throw new Error('Cô/thầy vừa nhận mã. Vui lòng chờ 60 giây trước khi yêu cầu lại.');
  canConEmail_();
  const raw=('000000'+Math.floor(Math.random()*1000000)).slice(-6);append_(db,'LoginCodes',{id:Utilities.getUuid(),email:email,codeHash:digest_(raw),expiresAt:Date.now()+TH50.CODE_MINUTES*60000,used:false,createdAt:now_()});cache.put(key,'1',60);
  MailApp.sendEmail({to:email,subject:'Mã đăng nhập Trường học 5.0',htmlBody:'<p>Mã đăng nhập của cô/thầy:</p><h1 style="letter-spacing:5px">'+raw+'</h1><p>Mã có hiệu lực trong '+TH50.CODE_MINUTES+' phút.</p>',name:'Trường học 5.0'});return {sent:true,message:'Mã đăng nhập đã được gửi vào email.'};
}
function setUserPermissions(token,email,features){const admin=requireRole_(token,['ADMIN']),db=db_();email=cleanEmail_(email);features=Array.isArray(features)?features.filter(x=>TH50_FEATURES.indexOf(x)>=0).join(','):'';const u=updateWhere_(db,'Users',r=>r.email===email,r=>{r.features=features;return r;});if(!u)throw new Error('Không tìm thấy tài khoản.');audit_(db,admin,'SET_PERMISSIONS',email+':'+features);return publicUser_(u);}
function approveRegistration(token,email,role,teamId){
  const admin=requireRole_(token,['ADMIN']),db=db_();email=cleanEmail_(email);ensureCollabSheets_(db);teamId=cleanText_(teamId,80);if(teamId&&!read_(db,'Teams').some(t=>t.id===teamId))throw new Error('Không tìm thấy tổ chuyên môn đã chọn.');const pendingRaw=P_().getProperty(pendingKey_(email));if(!read_(db,'Users').some(r=>r.email===email)&&pendingRaw)append_(db,'Users',JSON.parse(pendingRaw));
  role=['LEADER','TEACHER'].indexOf(role)>=0?role:'TEACHER';const code=('000000'+Math.floor(Math.random()*1000000)).slice(-6);
  const cho=read_(db,'Users').find(r=>r.email===email);if(dvTruong_()&&!(teamId||cho&&cho.teamId&&read_(db,'Teams').some(t=>t.id===cho.teamId)))throw new Error('Vui lòng chọn tổ chuyên môn cho giáo viên trước khi duyệt.');
  const u=updateWhere_(db,'Users',r=>r.email===email,r=>Object.assign(r,teamId?{teamId:teamId}:{},{role:role,status:'INVITED',approvedAt:now_(),approvedBy:admin.email,activationHash:digest_(code),activationExpiry:Date.now()+7*86400000}));
  MailApp.sendEmail({to:email,subject:'Tài khoản Trường học 5.0 đã được duyệt',htmlBody:'<p>Xin chào '+escapeHtml_(u.name)+',</p><p>Tài khoản của cô/thầy đã được duyệt với vai trò <b>'+escapeHtml_(role==='LEADER'?'Tổ trưởng':'Giáo viên')+'</b>.</p><p>Mã kích hoạt: <b style="font-size:22px;letter-spacing:4px">'+code+'</b></p><p>Mở trang kích hoạt tài khoản: <a href="'+dvLinkKichHoat_(email)+'">Kích hoạt tài khoản</a></p>',name:'Trường học 5.0'});
  ensureCollabSheets_(db);const toDuyet=u.teamId||toMacDinh_(),oldMember=read_(db,'Memberships').find(m=>m.teamId===toDuyet&&m.userEmail===email);if(!oldMember)append_(db,'Memberships',{id:Utilities.getUuid(),teamId:toDuyet,userEmail:email,role:role,status:'INVITED',className:'',phone:u.phone||'',features:u.features||'notebooks,meetings',createdAt:now_(),createdBy:admin.email});P_().deleteProperty(pendingKey_(email));return true;
}
function activateAccount(input){
  input=input||{};const email=cleanEmail_(input.email),code=String(input.code||'').replace(/\D/g,'');const db=db_();
  const u=read_(db,'Users').find(r=>r.email===email);if(!u||u.status!=='INVITED'||Number(u.activationExpiry)<Date.now()||u.activationHash!==digest_(code))throw new Error('Mã kích hoạt không đúng hoặc đã hết hạn.');
  updateWhere_(db,'Users',r=>r.email===email,r=>Object.assign(r,{status:'APPROVED',activationHash:'',activationExpiry:''}));
  return {activated:true,email:email,message:'Kích hoạt thành công. Cô/thầy hãy đăng nhập bằng mã gửi qua email.'};
}

function requestLogin(input) {
  input = input || {};
  const email = cleanEmail_(input.email);
  const name = cleanText_(input.name, 100);
  const phone = cleanText_(input.phone, 25);
  if (!email || !name || !phone) throw new Error('Vui lòng nhập đủ họ tên, email và số điện thoại.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email chưa đúng định dạng.');
  if (!/^\+?[0-9 ()-]{8,25}$/.test(phone)) throw new Error('Số điện thoại chưa đúng định dạng.');
  const cache = CacheService.getScriptCache(), key = 'login:' + digest_(email);
  if (cache.get(key)) throw new Error('Cô/thầy vừa nhận mã. Vui lòng chờ 60 giây trước khi yêu cầu lại.');
  const db = db_(), users = read_(db, 'Users');
  let user = users.find(r => r.email === email);
  if (!user) {
    user = {
      id: Utilities.getUuid(), email: email, name: name, phone: phone,
      role: email === TH50.ADMIN ? 'ADMIN' : 'TEACHER',
      status: email === TH50.ADMIN ? 'APPROVED' : 'PENDING',
      createdAt: now_(), approvedAt: email === TH50.ADMIN ? now_() : '', approvedBy: email === TH50.ADMIN ? TH50.ADMIN : '',
      personalFolderId: ''
    };
    append_(db, 'Users', user);
  } else if (user.status === 'REJECTED') {
    throw new Error('Yêu cầu đăng ký này chưa được chấp thuận. Vui lòng liên hệ quản trị viên.');
  }
  const raw = ('000000' + Math.floor(Math.random() * 1000000)).slice(-6);
  append_(db, 'LoginCodes', {id:Utilities.getUuid(), email:email, codeHash:digest_(raw), expiresAt:Date.now() + TH50.CODE_MINUTES * 60000, used:false, createdAt:now_()});
  cache.put(key, '1', 60);
  MailApp.sendEmail({
    to: email,
    subject: 'Mã đăng nhập Trường học 5.0',
    htmlBody: '<p>Xin chào '+escapeHtml_(name)+',</p><p>Mã xác thực của cô/thầy là:</p><h1 style="letter-spacing:5px">'+raw+'</h1><p>Mã có hiệu lực trong '+TH50.CODE_MINUTES+' phút. Không chia sẻ mã này cho người khác.</p>',
    name: 'Trường học 5.0'
  });
  return {sent:true, status:user.status, message:user.status === 'PENDING' ? 'Mã đã gửi. Sau khi xác thực, yêu cầu của cô/thầy sẽ chờ quản trị viên phê duyệt.' : 'Mã xác thực đã được gửi vào email.'};
}

function verifyLogin(input) {
  input = input || {};
  const email = cleanEmail_(input.email), code = String(input.code || '').replace(/\D/g, '');
  if (!email || code.length !== 6) throw new Error('Vui lòng nhập email và mã gồm 6 chữ số.');
  const db = db_(), rows = read_(db, 'LoginCodes').filter(r => r.email === email && !asBool_(r.used));
  const item = rows.reverse().find(r => Number(r.expiresAt) > Date.now() && r.codeHash === digest_(code));
  if (!item) throw new Error('Mã không đúng hoặc đã hết hạn. Cô/thầy hãy yêu cầu mã mới.');
  updateWhere_(db, 'LoginCodes', r => r.id === item.id, r => Object.assign(r, {used:true, usedAt:now_()}));
  const user = read_(db, 'Users').find(r => r.email === email);
  if (!user) throw new Error('Không tìm thấy hồ sơ đăng ký.');
  if (user.status !== 'APPROVED') return {pending:true, message:'Email đã xác thực. Hồ sơ đang chờ quản trị viên phê duyệt.'};
  const token = issueToken_(user);
  return {token:token, user:publicUser_(user)};
}


function systemLinks_(db) {
  const root = folder_('root');
  return {github:'https://github.com/hcmtranle/truonghoc5.0', sheet:'https://docs.google.com/spreadsheets/d/'+db.getId()+'/edit', drive:'https://drive.google.com/drive/folders/'+root.getId()};
}

function saveModule(token, input) {
  const user = requireRole_(token, ['ADMIN']), db = db_();
  input = input || {};
  const name = cleanText_(input.name, 100), description = cleanText_(input.description, 500);
  if (!name) throw new Error('Tên module không được để trống.');
  const item = {
    id: cleanText_(input.id, 80) || Utilities.getUuid(),
    icon: cleanText_(input.icon, 16) || suggestIcon_(name + ' ' + description),
    name:name, description:description,
    deployUrl: safeUrl_(input.deployUrl), scriptUrl:safeUrl_(input.scriptUrl), driveUrl:safeUrl_(input.driveUrl),
    status: ['LIVE','DRAFT','PAUSED'].indexOf(input.status) >= 0 ? input.status : 'LIVE',
    visible: input.visible !== false, order: Number(input.order) || Date.now(), updatedAt:now_(), updatedBy:user.email
  };
  const existing = read_(db, 'Modules').some(r => r.id === item.id);
  existing ? updateWhere_(db, 'Modules', r => r.id === item.id, () => item) : append_(db, 'Modules', item);
  audit_(db, user, 'SAVE_MODULE', item.id);
  return item;
}

function setApproval(token, email, approved, role) {
  const admin = requireRole_(token, ['ADMIN']), db = db_();
  email = cleanEmail_(email); if (!email) throw new Error('Email không hợp lệ.');
  const found = read_(db, 'Users').find(r => r.email === email); if (!found) throw new Error('Không tìm thấy hồ sơ.');
  const nextRole = ['ADMIN','LEADER','DEPUTY','TEACHER'].indexOf(role) >= 0 ? role : found.role;
  updateWhere_(db, 'Users', r => r.email === email, r => Object.assign(r, {
    status: approved ? 'APPROVED' : 'REJECTED', role:nextRole,
    approvedAt:now_(), approvedBy:admin.email,
    personalFolderId: approved ? (r.personalFolderId || personalFolder_(r).getId()) : r.personalFolderId
  }));
  audit_(db, admin, approved ? 'APPROVE_USER' : 'REJECT_USER', email);
  return true;
}

function saveMeetingMinutes(token,input){
 const user=requireRole_(token,['ADMIN','LEADER','DEPUTY','TEACHER']),db=db_();input=input||{};
 const item={id:Utilities.getUuid(),teamId:activeTeamId_(user,db,input.teamId),title:cleanText_(input.title,180),meetingTime:cleanText_(input.meetingTime,80)||Utilities.formatDate(new Date(),TH50.TZ,'dd/MM/yyyy HH:mm'),location:cleanText_(input.location,180),chair:cleanText_(input.chair,120),secretary:cleanText_(input.secretary,120),principalRepresentative:cleanText_(input.principalRepresentative,120),attendees:cleanText_(input.attendees,1500),agenda:cleanText_(input.agenda,4000),researchTopic:cleanText_(input.researchTopic,1000),evidence:cleanText_(input.evidence,6000),discussion:cleanText_(input.discussion,12000),conclusion:cleanText_(input.conclusion,6000),assignments:cleanText_(input.assignments,6000),endHour:cleanText_(input.endHour,2),endMinute:cleanText_(input.endMinute,2),ownerEmail:user.email,ownerName:user.name,createdAt:now_(),expiresAt:expiry_(),status:'ACTIVE',docId:'',docUrl:'',pdfUrl:'',docxUrl:'',secretarySignatureUrl:'',principalSignatureUrl:'',chairSignatureUrl:'',attendeesSignatureUrl:''};
 if(!item.title||!item.chair||!item.secretary||!item.agenda||!item.discussion||!item.conclusion)throw new Error('Vui lòng điền đủ tên biên bản, chủ trì, thư ký, nội dung, ý kiến thảo luận và kết luận.');
 [['secretarySignatureData','secretarySignatureUrl'],['principalSignatureData','principalSignatureUrl'],['chairSignatureData','chairSignatureUrl'],['attendeesSignatureData','attendeesSignatureUrl']].forEach(x=>{if(input[x[0]])item[x[1]]=saveSignature_(user,input[x[0]])});
 item.memberSigns=memberSigns_(user,input.memberSigns);
 const doc=createMeetingMinutesDoc_(item);item.docId=doc.getId();item.docUrl=doc.getUrl();append_(db,'Minutes',item);SpreadsheetApp.flush();audit_(db,user,'CREATE_MINUTES',item.id);return item;
}
function signatureBlob_(url){const id=fileIdFromUrl_(url);return id?DriveApp.getFileById(id).getBlob():null;}
function addSignature_(cell,url){if(!url)return;const blob=signatureBlob_(url);if(!blob)return;const p=cell.appendParagraph('');p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);p.appendInlineImage(blob).setWidth(110).setHeight(55);}

function exportMeetingMinutesPdf(token,id){const user=requireUser_(token),db=db_(),item=read_(db,'Minutes').find(n=>n.id===id&&canSeeMinutes_(user,n));if(!item)throw new Error('Không tìm thấy biên bản.');const pdf=folder_('minutes').createFile(DriveApp.getFileById(String(item.docId||'')||fileIdFromUrl_(item.docUrl)).getAs(MimeType.PDF).setName(safeFile_(item.title)+'.pdf'));dvChiaSe_(pdf.getId());updateWhere_(db,'Minutes',r=>r.id===id,r=>{r.pdfUrl=pdf.getUrl();return r});audit_(db,user,'EXPORT_MINUTES_PDF',id);return {pdfUrl:pdf.getUrl()};}

function saveNotebook(token, input) {
  const user = requireRole_(token, ['ADMIN','LEADER','DEPUTY','TEACHER']), db = db_();
  input = input || {};
  const title = cleanText_(input.title, 160), chair = cleanText_(input.chair, 120), creator = cleanText_(input.creator, 120), attendees=cleanText_(input.attendees,500), content = cleanText_(input.content, 20000);
  if (!title || !chair || !creator || !content) throw new Error('Vui lòng điền tên sổ họp, người chủ trì, người tạo sổ và nội dung triển khai.');
  const time = cleanText_(input.meetingTime, 80) || Utilities.formatDate(new Date(), TH50.TZ, 'dd/MM/yyyy HH:mm');
  const item = {id:Utilities.getUuid(), title:title, meetingTime:time, chair:chair, attendees:attendees, content:content, ownerEmail:user.email, ownerName:creator, createdAt:now_(), expiresAt:expiry_(), status:'ACTIVE', docId:'', docUrl:'', pdfUrl:'', docxUrl:'', signatureUrl:''};
  if (input.signatureData) item.signatureUrl = saveSignature_(user, input.signatureData);
  const doc = createNotebookDoc_(item);
  const folder = folder_('notebooks');
  item.docId = doc.getId(); item.docUrl = doc.getUrl(); item.pdfUrl = '';
  append_(db, 'Notebooks', item); SpreadsheetApp.flush(); audit_(db, user, 'CREATE_NOTEBOOK', item.id);
  return item;
}

function exportNotebookPdf(token,id){
  const user=requireUser_(token),db=db_();const item=read_(db,'Notebooks').find(n=>n.id===id&&(user.role==='ADMIN'||n.ownerEmail===user.email));if(!item)throw new Error('Không tìm thấy sổ họp.');
  const docId=String(item.docId||'')||((String(item.docUrl).match(/\/d\/([A-Za-z0-9_-]+)/)||[])[1]);if(!docId)throw new Error('Sổ họp chưa có mã tài liệu Google Docs. Vui lòng lưu lại.');
  const pdf=folder_('notebooks').createFile(DriveApp.getFileById(docId).getAs(MimeType.PDF).setName(safeFile_(item.title)+'.pdf'));
  dvChiaSe_(pdf.getId());updateWhere_(db,'Notebooks',r=>r.id===id,r=>{r.pdfUrl=pdf.getUrl();return r;});audit_(db,user,'EXPORT_NOTEBOOK_PDF',id);return {pdfUrl:pdf.getUrl()};
}

function expiry_(){const d=new Date();d.setDate(d.getDate()+retention_());return Utilities.formatDate(d,TH50.TZ,"yyyy-MM-dd'T'HH:mm:ss");}
function fileIdFromUrl_(url){const m=String(url||'').match(/[-\w]{25,}/);return m?m[0]:'';}
function exportDocx_(docId,title,folder){const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(docId)+'/export?mimeType='+encodeURIComponent('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});if(response.getResponseCode()!==200)throw new Error('Không thể xuất Word từ Google Docs.');const f=folder.createFile(response.getBlob().setName(safeFile_(title)+'.docx'));dvChiaSe_(f.getId());return f;}
function exportNotebookDocx(token,id){const user=requireUser_(token),db=db_(),item=read_(db,'Notebooks').find(n=>n.id===id&&(user.role==='ADMIN'||n.ownerEmail===user.email));if(!item)throw new Error('Không tìm thấy sổ họp.');const docId=String(item.docId||'')||fileIdFromUrl_(item.docUrl);if(!docId)throw new Error('Sổ họp chưa có mã Google Docs.');const file=exportDocx_(docId,item.title,folder_('notebooks'));updateWhere_(db,'Notebooks',r=>r.id===id,r=>{r.docxUrl=file.getUrl();return r});audit_(db,user,'EXPORT_NOTEBOOK_DOCX',id);return {docxUrl:file.getUrl()};}
function exportMeetingMinutesDocx(token,id){const user=requireUser_(token),db=db_(),item=read_(db,'Minutes').find(n=>n.id===id&&canSeeMinutes_(user,n));if(!item)throw new Error('Không tìm thấy biên bản.');const docId=String(item.docId||'')||fileIdFromUrl_(item.docUrl);if(!docId)throw new Error('Biên bản chưa có mã Google Docs.');const file=exportDocx_(docId,item.title,folder_('minutes'));updateWhere_(db,'Minutes',r=>r.id===id,r=>{r.docxUrl=file.getUrl();return r});audit_(db,user,'EXPORT_MINUTES_DOCX',id);return {docxUrl:file.getUrl()};}
function createPersonalNotebookFromMinutes(token,minutesId,input){const user=requireRole_(token,['ADMIN','LEADER','DEPUTY','TEACHER']),db=db_(),m=read_(db,'Minutes').find(x=>x.id===minutesId&&canReadMinutes_(user,x));if(!m)throw new Error('Không tìm thấy biên bản đã chọn.');input=input||{};const content=['Nội dung cuộc họp: '+m.agenda,(m.discussion?'Ý kiến cần ghi nhớ: '+m.discussion:''),(m.conclusion?'Kết luận: '+m.conclusion:''),(m.assignments?'Nhiệm vụ cá nhân/Phân công: '+m.assignments:'')].filter(Boolean).join('\n\n');return saveNotebook(token,{title:cleanText_(input.title,160)||('CÁ NHÂN - '+m.title),meetingTime:m.meetingTime,chair:m.chair,creator:cleanText_(input.creator,120)||user.name,attendees:user.name,content:content});}
function cleanupExpiredDocuments(){
  dvRa_();cleanupCore_();
  dvDong_().filter(r=>r.TrangThai==='Đang hoạt động').forEach(r=>{try{if(dvVao_(r.MaDonVi))cleanupCore_()}catch(e){}});
  dvRa_();
}
function cleanupCore_(){const db=db_(),cut=Date.now();aiSheets_(db);['Notebooks','Minutes','AiDocs','AiUploads'].forEach(name=>read_(db,name).forEach(item=>{if(item.status==='EXPIRED')return;const giuNoiDung=!!DV_.ma&&(name==='Notebooks'||name==='Minutes');if(giuNoiDung&&!item.docId&&!item.docUrl)return;let expires=item.expiresAt?new Date(item.expiresAt).getTime():0;if(!expires&&item.createdAt){const d=new Date(item.createdAt);d.setDate(d.getDate()+retention_());expires=d.getTime()}if(expires&&expires<=cut){[item.fileId,item.docId||fileIdFromUrl_(item.docUrl),fileIdFromUrl_(item.pdfUrl),fileIdFromUrl_(item.docxUrl)].filter(Boolean).forEach(id=>{try{DriveApp.getFileById(id).setTrashed(true)}catch(e){}});updateWhere_(db,name,r=>r.id===item.id,r=>{if(giuNoiDung)Object.assign(r,{docId:'',docUrl:'',pdfUrl:'',docxUrl:''});else r.status='EXPIRED';return r})}}));}
function installRetentionTrigger(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='cleanupExpiredDocuments').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('cleanupExpiredDocuments').timeBased().everyDays(1).atHour(2).create();return true;}

function logout(token) {
  if (token) P_().deleteProperty('session:' + digest_(token));
  return true;
}

function baseSchema_(ss){
  [['Users',['id','email','name','phone','role','requestedRole','status','createdAt','approvedAt','approvedBy','personalFolderId','activationHash','activationExpiry','features']],['LoginCodes',['id','email','codeHash','expiresAt','used','createdAt','usedAt']],['Modules',['id','icon','name','description','deployUrl','scriptUrl','driveUrl','status','visible','order','updatedAt','updatedBy']],['Notebooks',['id','title','meetingTime','chair','attendees','content','ownerEmail','ownerName','createdAt','expiresAt','status','docId','docUrl','pdfUrl','docxUrl','signatureUrl']],['Minutes',['id','title','meetingTime','location','chair','secretary','principalRepresentative','attendees','agenda','researchTopic','evidence','discussion','conclusion','assignments','endHour','endMinute','ownerEmail','ownerName','createdAt','expiresAt','status','docId','docUrl','pdfUrl','docxUrl','secretarySignatureUrl','principalSignatureUrl','chairSignatureUrl','attendeesSignatureUrl']],['Audit',['id','at','email','action','target']]].forEach(x=>sheet_(ss,x[0],x[1]));
}
function db_() {
  if(DV_.ma)return dvDb_();
  const props=P_();let id=props.getProperty('dbId'),ss=id?SpreadsheetApp.openById(id):null;
  if(!ss){ss=SpreadsheetApp.create('Trường học 5.0 — Dữ liệu');props.setProperty('dbId',ss.getId());folder_('root').addFile(DriveApp.getFileById(ss.getId()));}
  if(props.getProperty('schemaVersion')!=='27'){
    baseSchema_(ss);props.setProperty('schemaVersion','27');
  } return ss;
}
function sheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else { const current=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; const missing=headers.filter(h=>current.indexOf(h)<0); if(missing.length) sh.getRange(1,current.length+1,1,missing.length).setValues([missing]); }
  return sh;
}
function read_(ss, name) {
  const sh = ss.getSheetByName(name), v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const h=v[0]; return v.slice(1).filter(r=>r.some(x=>x!=='' )).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i] instanceof Date?Utilities.formatDate(r[i],TH50.TZ,"yyyy-MM-dd'T'HH:mm:ss"):r[i]])));
}
function append_(ss,name,obj) { const sh=ss.getSheetByName(name), h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; sh.appendRow(h.map(k=>obj[k]===undefined?'':obj[k])); }
function updateWhere_(ss,name,match,transform) {
  const sh=ss.getSheetByName(name), v=sh.getDataRange().getValues(), h=v[0];
  for(let i=1;i<v.length;i++){const obj=Object.fromEntries(h.map((k,j)=>[k,v[i][j]]));if(match(obj)){const next=transform(obj);sh.getRange(i+1,1,1,h.length).setValues([h.map(k=>next[k]===undefined?'':next[k])]);return next;}}
  throw new Error('Không tìm thấy dữ liệu để cập nhật.');
}
function folder_(kind) {
  const p=P_(), key='folder:'+kind; let id=p.getProperty(key);
  if(id) return DriveApp.getFolderById(id);
  let f;
  if(kind==='root') { if(DV_.ma)f=dvThuMuc_(); else { const it=DriveApp.getFoldersByName(TH50.ROOT); f=it.hasNext()?it.next():DriveApp.createFolder(TH50.ROOT); } }
  else { f=folder_('root').createFolder(kind==='notebooks'?'Sổ họp':kind==='minutes'?'Biên bản họp tổ chuyên môn':kind==='signatures'?'Chữ ký':kind==='aiDocs'?'Sản phẩm trợ lý AI':kind==='aiUploads'?'Tài liệu tải lên trợ lý AI':'Không gian cá nhân'); }
  p.setProperty(key,f.getId()); return f;
}
function personalFolder_(user) {
  const root=folder_('personal'), name=safeFile_(user.name)+' — '+user.email; const it=root.getFoldersByName(name); return it.hasNext()?it.next():root.createFolder(name);
}
function issueToken_(user) {
  const token=Utilities.getUuid()+Utilities.getUuid().replace(/-/g,'');
  P_().setProperty('session:'+digest_(token), JSON.stringify({email:user.email,expires:Date.now()+TH50.TOKEN_HOURS*3600000}));
  if(Math.random()<0.05){try{purgeSessions_()}catch(e){}}
  return token;
}
function requireUser_(token) {
  if(!token) throw new Error('Phiên đăng nhập đã hết hạn.');
  const raw=P_().getProperty('session:'+digest_(token));
  if(!raw) throw new Error('Phiên đăng nhập đã hết hạn.'); const s=JSON.parse(raw);
  if(s.expires<Date.now()) {P_().deleteProperty('session:'+digest_(token));throw new Error('Phiên đăng nhập đã hết hạn.');}
  const u=read_(db_(),'Users').find(r=>r.email===s.email && r.status==='APPROVED'); if(!u) throw new Error('Tài khoản chưa được phê duyệt.');
  return u;
}
function requireRole_(token,roles){const u=requireUser_(token);if(roles.indexOf(u.role)<0)throw new Error('Cô/thầy không có quyền thực hiện chức năng này.');return u;}
function saveSignature_(user, data) {
  const m=String(data).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!m) throw new Error('Chữ ký cần là ảnh PNG, JPG hoặc WebP.');
  const bytes=Utilities.base64Decode(m[2]); if(bytes.length>1024*1024) throw new Error('Ảnh chữ ký tối đa 1 MB.');
  const file=folder_('signatures').createFile(Utilities.newBlob(bytes,m[1],'signature-'+Date.now())); return file.getUrl();
}
function audit_(db,user,action,target){append_(db,'Audit',{id:Utilities.getUuid(),at:now_(),email:user.email,action:action,target:target});}
function cleanText_(v,n){return String(v||'').trim().replace(/[<>]/g,'').slice(0,n);}
function cleanEmail_(v){return cleanText_(v,254).toLowerCase();}
function safeUrl_(v){v=String(v||'').trim();if(!v)return '';if(!/^https:\/\//i.test(v))throw new Error('Liên kết phải bắt đầu bằng https://');return v.slice(0,1000);}
function safeFile_(v){return String(v).replace(/[\\/:*?"<>|]/g,'-').slice(0,100);}
function digest_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v)).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('');}
function now_(){return Utilities.formatDate(new Date(),TH50.TZ,"yyyy-MM-dd'T'HH:mm:ss");}
function asBool_(v){return v===true||String(v).toLowerCase()==='true';}
function suggestIcon_(s){s=String(s).toLowerCase();if(/họp|chuyên môn/.test(s))return '👥';if(/bài giảng|học sinh|lớp/.test(s))return '📚';if(/drive|học liệu/.test(s))return '📁';if(/thi đua|điểm/.test(s))return '🏆';if(/lịch/.test(s))return '🗓️';return '🧩';}
function escapeHtml_(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}


// Release 33: teams, verified members, meeting assignments, Calendar/Meet and Gemini assistants.
function listPublicTeams(){const db=db_();return {items:ensureCollabSheets_(db).filter(t=>asBool_(t.active)).map(t=>({id:t.id,name:t.name}))};}
function listTeams(token){const u=requireUser_(token),db=db_();return {items:ensureCollabSheets_(db).filter(t=>asBool_(t.active)||u.role==='ADMIN'),activeTeamId:activeTeamId_(u,db)};}
function saveTeam(token,input){const u=requireRole_(token,['ADMIN']),db=db_();ensureCollabSheets_(db);input=input||{};const name=cleanText_(input.name,100);if(!name)throw new Error('Vui lòng nhập tên tổ chuyên môn.');const chuan=x=>String(x||'').replace(/\s+/g,' ').trim().toLowerCase();if(read_(db,'Teams').some(x=>chuan(x.name)===chuan(name)&&x.id!==cleanText_(input.id,80)))throw new Error('Đã có tổ chuyên môn tên “'+name+'”. Vui lòng đặt tên khác.');const item={id:cleanText_(input.id,80)||Utilities.getUuid(),name:name,schoolYear:cleanText_(input.schoolYear,30),active:input.active!==false,createdAt:now_(),createdBy:u.email};const old=read_(db,'Teams').some(x=>x.id===item.id);old?updateWhere_(db,'Teams',x=>x.id===item.id,()=>item):append_(db,'Teams',item);COLLAB_TEAMS_=null;audit_(db,u,'SAVE_TEAM',item.id);return item;}
function assignMeetingSecretary(token,meetingId,email){const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);const meeting=read_(db,'Meetings').find(x=>x.id===meetingId);if(!meeting)throw new Error('Không tìm thấy lịch họp.');email=cleanEmail_(email);const item={id:Utilities.getUuid(),teamId:meeting.teamId,meetingId:meetingId,userEmail:email,assignmentType:'SECRETARY',status:'ACTIVE',createdAt:now_(),createdBy:actor.email};append_(db,'Assignments',item);updateWhere_(db,'Users',x=>x.email===email,x=>{const f=String(x.features||'').split(',').filter(Boolean);if(f.indexOf('minutes')<0)f.push('minutes');x.features=f.join(',');return x;});audit_(db,actor,'ASSIGN_SECRETARY',meetingId+':'+email);return item;}
function deleteNotebook(token,id){const u=requireUser_(token),db=db_(),item=read_(db,'Notebooks').find(n=>n.id===id);if(!item||item.status==='DELETED')throw new Error('Không tìm thấy sổ họp.');if(u.role!=='ADMIN'&&item.ownerEmail!==u.email)throw new Error('Cô/thầy không có quyền xóa sổ họp này.');[item.docId,fileIdFromUrl_(item.pdfUrl),fileIdFromUrl_(item.docxUrl),fileIdFromUrl_(item.signatureUrl)].filter(Boolean).forEach(fid=>{try{DriveApp.getFileById(fid).setTrashed(true)}catch(e){}});updateWhere_(db,'Notebooks',n=>n.id===id,n=>{n.status='DELETED';return n;});audit_(db,u,'DELETE_NOTEBOOK',id);return {deleted:true};}
function getAiStatus(token){requireUser_(token);return {configured:!!P_().getProperty('GEMINI_API_KEY'),model:'gemini-3.8-flash'};}
function setGeminiApiKey(token,key){requireRole_(token,['ADMIN']);key=String(key||'').trim();if(!key)throw new Error('Vui lòng nhập API key Gemini.');P_().setProperty('GEMINI_API_KEY',key);AI_PROPS_=null;return {configured:true,model:'gemini-3.8-flash'};}
function geminiAssistant(token,input){const u=requireUser_(token);input=input||{};const key=P_().getProperty('GEMINI_API_KEY');if(!key)throw new Error('Admin chưa cấu hình API key Gemini trong Cài đặt.');const mode=String(input.mode||'lesson'),question=cleanText_(input.question,6000),context=cleanText_(input.context,30000);let instruction=mode==='text'?'Bạn là trợ lý phân tích văn bản cho giáo viên. Phân tích mục đích, ý chính, yêu cầu cần xử lý, rủi ro và đề xuất các bước cụ thể bằng tiếng Việt.':mode==='research'?'Bạn là trợ lý nghiên cứu bài học theo Công văn 4069/BGDĐT-GDPT. Tập trung vào hoạt động học và sự tiến bộ của học sinh, đề xuất minh chứng quan sát, điều chỉnh bài học; không xếp loại giáo viên.':'Bạn là trợ lý phân tích bài học/chủ đề SGK tiểu học. Xác định mục tiêu, yêu cầu cần đạt, khó khăn dự kiến, hoạt động học tích cực, câu hỏi đánh giá và điều chỉnh cho học sinh.';const parts=[{text:instruction+'\n\nNội dung/tài liệu:\n'+context+'\n\nYêu cầu của người dùng: '+(question||'Hãy phân tích và đề xuất hoạt động phù hợp.')}];if(input.fileData){const m=String(input.fileData).match(/^data:([^;]+);base64,(.+)$/);if(!m)throw new Error('Tệp tải lên không hợp lệ.');if(m[2].length>12000000)throw new Error('Tệp quá lớn. Vui lòng dùng tệp dưới khoảng 8 MB.');parts.push({inlineData:{mimeType:m[1],data:m[2]}});}const response=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key='+encodeURIComponent(key),{method:'post',contentType:'application/json',payload:JSON.stringify({contents:[{role:'user',parts:parts}],generationConfig:{temperature:0.35,maxOutputTokens:4096}}),muteHttpExceptions:true});if(response.getResponseCode()>=300)throw new Error('Gemini chưa phản hồi: '+response.getContentText().slice(0,300));const body=JSON.parse(response.getContentText()),answer=((body.candidates||[])[0]||{}).content;const text=((answer&&answer.parts)||[]).map(p=>p.text||'').join('\n');if(!text)throw new Error('Gemini chưa tạo được nội dung.');audit_(db_(),u,'AI_'+mode.toUpperCase(),'gemini-3.8-flash');return {text:text,model:'gemini-3.8-flash'};}

// Release 13: separate admin principal from personal account.

// Release 20: durable registration queue and notebook document ID.

// Release 34: hồ sơ cá nhân và ảnh đại diện, nhiều tổ chuyên môn, phân quyền tổ viên, xóa thành viên/văn bản,
// lịch họp trực tiếp/trực tuyến, điểm danh, đầu văn bản theo thể thức hành chính.
const TH50_FEATURES=['meetings','notebooks','minutes','personalNotebook','members','research','analysis','textAssistant','lessons','awards','personal'];
const TH50_DEFAULT_ORG={authority:'ỦY BAN NHÂN DÂN PHƯỜNG ĐÔNG HƯNG THUẬN',school:'TRƯỜNG TIỂU HỌC TRƯƠNG ĐỊNH'};
let COLLAB_TEAMS_=null;

function org_(){let o={};try{o=JSON.parse(P_().getProperty('orgSettings')||'{}')||{}}catch(e){}if(DV_.ma)return {authority:o.authority||DV_.coQuan,school:o.school||DV_.truong};return {authority:o.authority||TH50_DEFAULT_ORG.authority,school:o.school||TH50_DEFAULT_ORG.school};}
function getPublicConfig(){return org_();}
function saveOrgSettings(token,input){
  const u=requireRole_(token,['ADMIN']);input=input||{};
  const o={authority:cleanText_(input.authority,150).toUpperCase(),school:cleanText_(input.school,150).toUpperCase()};
  if(!o.school)throw new Error('Vui lòng nhập tên trường.');
  P_().setProperty('orgSettings',JSON.stringify(o));audit_(db_(),u,'SAVE_ORG',o.school);return org_();
}

function ensureCollabSheets_(db){
  if(COLLAB_TEAMS_)return COLLAB_TEAMS_;
  sheet_(db,'Users',['id','email','name','phone','role','requestedRole','status','createdAt','approvedAt','approvedBy','personalFolderId','activationHash','activationExpiry','features','teamId','className','avatar']);
  sheet_(db,'Teams',['id','name','schoolYear','active','createdAt','createdBy']);
  sheet_(db,'Memberships',['id','teamId','userEmail','role','status','className','phone','features','createdAt','createdBy']);
  sheet_(db,'Meetings',['id','teamId','title','startAt','endAt','location','description','attendeeEmails','secretaryEmail','calendarEventId','meetUrl','status','createdAt','createdBy','mode','onlineTool','attendance']);
  sheet_(db,'Assignments',['id','teamId','meetingId','userEmail','assignmentType','status','createdAt','createdBy']);
  sheet_(db,'Minutes',['teamId','memberSigns']);
  let teams=read_(db,'Teams');
  if(dvTruong_()){const n=dvBoSungTo_(db,teams,DV_DS_TO_);if(n)teams=read_(db,'Teams');}
  else if(!teams.length){append_(db,'Teams',{id:'to-4',name:DV_.ma?DV_.to:'Tổ chuyên môn 4',schoolYear:'2026-2027',active:true,createdAt:now_(),createdBy:DV_.ma?'du-an-tong':TH50.ADMIN});teams=read_(db,'Teams');}
  COLLAB_TEAMS_=teams;return teams;
}
// Tổ đang dùng: Admin được chọn tổ để xem; người đã bị xóa khỏi mọi tổ thì không thuộc tổ nào.
function activeTeamId_(u,db,requested){
  const teams=ensureCollabSheets_(db);
  if(u.role==='ADMIN'){requested=cleanText_(requested,80);if(requested&&teams.some(t=>t.id===requested))return requested;}
  const mine=read_(db,'Memberships').filter(m=>m.userEmail===u.email),own=mine.find(m=>m.status!=='DISABLED'&&m.status!=='REMOVED');
  if(own)return own.teamId;
  if(mine.length&&u.role!=='ADMIN')return '';
  if(!dvTruong_())return u.teamId||'to-4';
  if(u.teamId&&teams.some(t=>t.id===u.teamId))return u.teamId;
  if(u.role==='ADMIN'){const t=teams.find(t=>asBool_(t.active))||teams[0];return t?t.id:'';}
  return '';
}
function teamName_(db,teamId){const t=ensureCollabSheets_(db).find(x=>x.id===teamId);return t?t.name:'Tổ chuyên môn';}
function updateAll_(ss,name,match,transform){
  const sh=ss.getSheetByName(name),v=sh.getDataRange().getValues(),h=v[0];let n=0;
  for(let i=1;i<v.length;i++){const obj=Object.fromEntries(h.map((k,j)=>[k,v[i][j]]));if(match(obj)){const next=transform(obj);sh.getRange(i+1,1,1,h.length).setValues([h.map(k=>next[k]===undefined?'':next[k])]);n++;}}
  return n;
}
function publicUser_(u){return {email:u.email,name:u.name,phone:u.phone,role:u.role,status:u.status,features:u.role==='ADMIN'||u.role==='LEADER'?'all':String(u.features||'notebooks,meetings'),teamId:u.teamId||'',className:u.className||'',avatar:u.avatar||'',hasAiKey:!!userAiKey_(u)};}

function liveDoc_(n){return n.status!=='EXPIRED'&&n.status!=='DELETED';}
function canSeeMinutes_(user,n,teamId){
  if(!liveDoc_(n))return false;
  if(user.role==='ADMIN'||n.ownerEmail===user.email)return true;
  if(user.role!=='LEADER')return false;
  return (n.teamId||'to-4')===(teamId===undefined?activeTeamId_(user,db_()):teamId);
}
function canReadMinutes_(user,n,teamId){
  if(canSeeMinutes_(user,n,teamId))return true;
  return liveDoc_(n)&&(n.teamId||'to-4')===(teamId===undefined?activeTeamId_(user,db_()):teamId);
}

function bootstrap(token,requestedTeam) {
  const user = requireUser_(token), db = db_();
  const teams=ensureCollabSheets_(db), teamId=activeTeamId_(user,db,requestedTeam), newest=(a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)), allMinutes=read_(db,'Minutes');
  return {
    user: publicUser_(user), org: org_(),
    modules: read_(db, 'Modules').filter(m => user.role === 'ADMIN' || asBool_(m.visible)).sort((a,b) => String(a.order).localeCompare(String(b.order))),
    notebooks: read_(db, 'Notebooks').filter(n => liveDoc_(n) && (user.role === 'ADMIN' || n.ownerEmail === user.email)).sort(newest),
    minutes: allMinutes.filter(n => canSeeMinutes_(user,n,teamId)).sort(newest),
    teamMinutes: allMinutes.filter(n => canReadMinutes_(user,n,teamId)).sort(newest).map(n=>({id:n.id,title:n.title,meetingTime:n.meetingTime})),
    approvals: user.role === 'ADMIN' ? read_(db, 'Users').filter(u => u.status === 'PENDING') : [],
    systemLinks: user.role === 'ADMIN' ? systemLinks_(db) : null,
    teams: user.role==='ADMIN'?teams:teams.filter(t=>t.id===teamId), activeTeamId: teamId, teamMembers: teamMembers_(db,teamId),
    meetings: read_(db,'Meetings').filter(m=>m.status!=='DELETED'&&m.teamId===teamId),
    aiDocs:aiDocsFor_(db,user),
    aiStatus:{configured:!!userAiKey_(user),model:'gemini-3.8-flash'}
  };
}

// ---------- Hồ sơ cá nhân ----------
function updateProfile(token,input){
  const u=requireUser_(token),db=db_();ensureCollabSheets_(db);input=input||{};
  const name=cleanText_(input.name,100),phone=cleanText_(input.phone,25),className=cleanText_(input.className,80);
  if(!name)throw new Error('Vui lòng nhập họ và tên.');
  if(phone&&!/^\+?[0-9 ()-]{8,25}$/.test(phone))throw new Error('Số điện thoại chưa đúng định dạng.');
  let avatar=String(u.avatar||'');
  if(input.avatar!==undefined&&input.avatar!==null){
    avatar=String(input.avatar);
    if(avatar&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(avatar)||avatar.length>45000))throw new Error('Ảnh đại diện chưa hợp lệ hoặc quá lớn.');
  }
  const next=updateWhere_(db,'Users',r=>r.id===u.id,r=>Object.assign(r,{name:name,phone:phone,className:className,avatar:avatar}));
  updateAll_(db,'Memberships',m=>m.userEmail===u.email,m=>Object.assign(m,{className:className,phone:phone}));
  audit_(db,u,'UPDATE_PROFILE',u.email);return publicUser_(next);
}

// ---------- Thành viên và phân quyền trong tổ ----------
function classKey_(s){return String(s||'').trim().toLowerCase().split(/(\d+)/).filter(x=>x!=='').map(x=>/^\d+$/.test(x)?Number(x):x);}
function byClass_(a,b){
  const x=classKey_(a.className),y=classKey_(b.className);
  if(!x.length!==!y.length)return x.length?-1:1;
  for(let i=0;i<Math.max(x.length,y.length);i++){
    if(x[i]===undefined)return -1;if(y[i]===undefined)return 1;
    if(x[i]!==y[i]){if(typeof x[i]==='number'&&typeof y[i]==='number')return x[i]-y[i];return String(x[i])<String(y[i])?-1:1;}
  }
  return String(a.name).localeCompare(String(b.name));
}
function teamMembers_(db,teamId){
  if(!teamId)return [];
  const users=read_(db,'Users');
  return read_(db,'Memberships').filter(m=>m.teamId===teamId&&m.status!=='REMOVED').map(m=>{
    const x=users.find(z=>z.email===m.userEmail)||{};
    return {id:m.id,teamId:m.teamId,userEmail:m.userEmail,email:m.userEmail,name:x.name||m.userEmail,role:x.role&&x.role!=='ADMIN'?x.role:m.role,status:m.status,accountStatus:x.status||m.status,className:String(m.className||x.className||''),phone:String(m.phone||x.phone||''),avatar:x.avatar||'',features:String(x.features||m.features||'')};
  }).sort(byClass_);
}
function listTeamMembers(token,teamId){const u=requireUser_(token),db=db_();return {items:teamMembers_(db,activeTeamId_(u,db,teamId))};}
function addTeamMember(token,input){
  const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);input=input||{};
  const email=cleanEmail_(input.email),name=cleanText_(input.name,100),phone=cleanText_(input.phone,25),className=cleanText_(input.className,80),role=['LEADER','DEPUTY','TEACHER'].indexOf(input.role)>=0?input.role:'TEACHER';
  const teamId=actor.role==='ADMIN'?(cleanText_(input.teamId,80)||activeTeamId_(actor,db)):activeTeamId_(actor,db);
  if(!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Vui lòng nhập đúng họ tên và email.');
  if(!teamId||!read_(db,'Teams').some(t=>t.id===teamId))throw new Error('Không tìm thấy tổ chuyên môn.');
  const memberships=read_(db,'Memberships');let user=read_(db,'Users').find(x=>x.email===email);
  if(user&&user.role==='ADMIN')throw new Error('Không thể thêm tài khoản Admin vào tổ.');
  if(user&&user.status==='DISABLED')throw new Error('Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ Admin.');
  if(actor.role==='LEADER'&&memberships.some(x=>x.userEmail===email&&x.teamId!==teamId&&x.status!=='REMOVED'&&x.status!=='DISABLED'))throw new Error('Tài khoản này đang thuộc tổ khác. Vui lòng liên hệ Admin.');
  const active=!!user&&user.status==='APPROVED';
  if(!user){user={id:Utilities.getUuid(),email:email,name:name,phone:phone,role:role,status:'INVITED',createdAt:now_(),approvedAt:now_(),approvedBy:actor.email,personalFolderId:'',activationHash:'',activationExpiry:'',features:'notebooks,meetings',teamId:teamId,className:className};append_(db,'Users',user);}
  const exists=memberships.find(x=>x.teamId===teamId&&x.userEmail===email);
  const member={id:exists&&exists.id||Utilities.getUuid(),teamId:teamId,userEmail:email,role:role,status:active?'ACTIVE':'INVITED',className:className,phone:phone,features:exists&&exists.features||user.features||'notebooks,meetings',createdAt:exists&&exists.createdAt||now_(),createdBy:actor.email};
  exists?updateWhere_(db,'Memberships',x=>x.id===exists.id,()=>member):append_(db,'Memberships',member);
  if(active){
    // Tài khoản đã kích hoạt: chỉ cập nhật hồ sơ, không bắt kích hoạt lại.
    updateWhere_(db,'Users',x=>x.email===email,x=>Object.assign(x,{name:name,phone:phone,role:role,className:className,teamId:teamId}));
  }else{
    const code=('000000'+Math.floor(Math.random()*1000000)).slice(-6);
    updateWhere_(db,'Users',x=>x.email===email,x=>Object.assign(x,{name:name,phone:phone,role:role,className:className,teamId:teamId,status:'INVITED',activationHash:digest_(code),activationExpiry:Date.now()+7*86400000}));
    P_().deleteProperty(pendingKey_(email));
    MailApp.sendEmail({to:email,subject:'Mời tham gia '+teamName_(db,teamId)+' — Trường học 5.0',htmlBody:'<p>Xin chào '+escapeHtml_(name)+',</p><p>Cô/thầy đã được thêm vào không gian '+escapeHtml_(teamName_(db,teamId))+'.</p><p>Mã kích hoạt: <b style="font-size:22px;letter-spacing:4px">'+code+'</b></p><p><a href="'+dvLinkKichHoat_(email)+'">Kích hoạt tài khoản</a></p>',name:'Trường học 5.0'});
  }
  audit_(db,actor,'ADD_TEAM_MEMBER',email+':'+teamId);return Object.assign({},member,{invited:!active});
}
function removeTeamMember(token,membershipId){
  const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);
  const m=read_(db,'Memberships').find(x=>x.id===membershipId&&x.status!=='REMOVED');if(!m)throw new Error('Không tìm thấy thành viên.');
  if(actor.role==='LEADER'){
    if(m.teamId!==activeTeamId_(actor,db))throw new Error('Tổ trưởng chỉ được xóa thành viên trong tổ của mình.');
    if(m.userEmail===actor.email)throw new Error('Cô/thầy không thể tự xóa mình khỏi tổ.');
    const target=read_(db,'Users').find(x=>x.email===m.userEmail);if(target&&target.role==='LEADER')throw new Error('Chỉ Admin được xóa tổ trưởng khỏi tổ.');
  }
  updateWhere_(db,'Memberships',x=>x.id===m.id,x=>Object.assign(x,{status:'REMOVED'}));
  audit_(db,actor,'REMOVE_TEAM_MEMBER',m.userEmail+':'+m.teamId);return {removed:true};
}
function leaderSetMemberPermissions(token,email,features,requestedTeam){
  const actor=requireRole_(token,['ADMIN','LEADER']),db=db_(),teamId=activeTeamId_(actor,db,requestedTeam);email=cleanEmail_(email);
  const m=read_(db,'Memberships').find(x=>x.teamId===teamId&&x.userEmail===email&&x.status!=='REMOVED');if(!m)throw new Error('Giáo viên này không thuộc tổ của cô/thầy.');
  const target=read_(db,'Users').find(x=>x.email===email);if(!target)throw new Error('Không tìm thấy tài khoản.');
  if(target.role==='ADMIN'||target.role==='LEADER')throw new Error('Tổ trưởng mặc nhiên được dùng toàn bộ tính năng.');
  const list=(Array.isArray(features)?features:[]).filter(x=>TH50_FEATURES.indexOf(x)>=0).join(',');
  updateWhere_(db,'Users',x=>x.email===email,x=>{x.features=list;return x;});
  updateWhere_(db,'Memberships',x=>x.id===m.id,x=>{x.features=list;return x;});
  audit_(db,actor,'LEADER_SET_PERMISSIONS',email+':'+list);return {email:email,features:list};
}

// ---------- Lịch họp, email mời và điểm danh ----------
function meetingTime_(iso){return Utilities.formatDate(new Date(iso),TH50.TZ,"HH:mm 'ngày' dd/MM/yyyy");}
function sendMeetingMail_(db,item,emails,members,actor){
  const sec=members.find(m=>m.email===item.secretaryEmail),online=item.mode==='ONLINE',row=(k,v)=>'<tr><td style="padding:4px 14px 4px 0;color:#667"><b>'+k+'</b></td><td style="padding:4px 0">'+v+'</td></tr>';
  const html='<p>Kính gửi quý Thầy cô '+escapeHtml_(teamName_(db,item.teamId))+',</p><p>'+escapeHtml_(actor.name||'Tổ trưởng')+' trân trọng mời quý Thầy cô tham dự cuộc họp:</p><table style="border-collapse:collapse">'
    +row('Nội dung',escapeHtml_(item.title))+row('Bắt đầu',meetingTime_(item.startAt))+row('Kết thúc',meetingTime_(item.endAt))+row('Hình thức',online?'Trực tuyến':'Trực tiếp')
    +(item.location?row('Địa điểm',escapeHtml_(item.location)):'')+(item.meetUrl?row('Đường dẫn họp','<a href="'+escapeHtml_(item.meetUrl)+'">'+escapeHtml_(item.meetUrl)+'</a>'):'')
    +(sec?row('Thư ký',escapeHtml_(sec.name)):'')+'</table>'+(item.description?'<p>'+escapeHtml_(item.description).replace(/\n/g,'<br>')+'</p>':'')
    +'<p>Quý Thầy cô vui lòng mở <a href="'+dvLinkTrang_()+'">Trường học 5.0</a>, mục Lịch họp &amp; điểm danh để xác nhận Có mặt hoặc Vắng có lý do.</p>';
  MailApp.sendEmail({to:emails.join(','),subject:'[Lịch họp] '+item.title+' — '+meetingTime_(item.startAt),htmlBody:html,name:'Trường học 5.0'});
}
function createMeeting(token,input){
  const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);input=input||{};
  const title=cleanText_(input.title,180),start=new Date(input.startAt||input.when),end=input.endAt?new Date(input.endAt):new Date(start.getTime()+60*60000);
  const teamId=actor.role==='ADMIN'?(cleanText_(input.teamId,80)||activeTeamId_(actor,db)):activeTeamId_(actor,db);
  if(!title||isNaN(start.getTime())||isNaN(end.getTime()))throw new Error('Vui lòng nhập tên và thời gian họp hợp lệ.');
  if(end.getTime()<=start.getTime())throw new Error('Giờ kết thúc phải sau giờ bắt đầu.');
  const mode=input.mode==='ONLINE'?'ONLINE':'OFFLINE',tool=mode==='ONLINE'?(input.onlineTool==='OTHER'||DV_.ma?'OTHER':'MEET'):'',customUrl=tool==='OTHER'?safeUrl_(input.customUrl):'';
  if(tool==='OTHER'&&!customUrl)throw new Error('Vui lòng dán đường dẫn phòng họp trực tuyến.');
  const members=teamMembers_(db,teamId).filter(m=>m.accountStatus!=='DISABLED'),allowed=members.map(m=>m.email);
  let emails=Array.isArray(input.attendeeEmails)?input.attendeeEmails.map(cleanEmail_):(input.attendeeEmails?[cleanEmail_(input.attendeeEmails)]:allowed);
  emails=emails.filter((e,i,a)=>e&&allowed.indexOf(e)>=0&&a.indexOf(e)===i);
  const location=cleanText_(input.location||input.place,180)||(mode==='ONLINE'?'Trực tuyến':''),description=cleanText_(input.description,4000);
  // Còn hạn mức thư thì hệ thống tự gửi thư mời tiếng Việt; hết hạn mức thì nhờ Google Calendar gửi thư mời.
  let ownMail=false;try{ownMail=!DV_.ma&&emails.length>0&&MailApp.getRemainingDailyQuota()>=emails.length}catch(e){}
  const event={summary:title,location:location,description:description+(customUrl?'\n\nĐường dẫn họp trực tuyến: '+customUrl:''),start:{dateTime:start.toISOString(),timeZone:TH50.TZ},end:{dateTime:end.toISOString(),timeZone:TH50.TZ},attendees:emails.map(email=>({email:email}))};
  if(tool==='MEET')event.conferenceData={createRequest:{requestId:Utilities.getUuid(),conferenceSolutionKey:{type:'hangoutsMeet'}}};
  // Đơn vị đăng ký: chỉ lưu lịch trong hệ thống, không ghi Google Calendar và không gửi email mời từ tài khoản hệ thống.
  // Ghi Google Lịch. Hệ thống chưa được cấp quyền Lịch (hoặc Google lỗi) thì vẫn lưu lịch họp và tự gửi email mời.
  let created={},lichLoi='';
  if(!DV_.ma){try{created=calendarCreate_(event,ownMail,tool,start,end)}catch(e){
    lichLoi=String(e&&e.message||e);
    if(tool==='MEET')throw new Error('Chưa tạo được phòng Google Meet vì hệ thống chưa được cấp quyền Google Lịch. Cô/thầy chọn “Dán đường dẫn” và dán link phòng họp; hoặc Admin cấp quyền Lịch một lần (hướng dẫn trong mục Cài đặt).');
    try{ownMail=emails.length>0&&MailApp.getRemainingDailyQuota()>=emails.length}catch(x){ownMail=false}
  }}
  const secretary=cleanEmail_(input.secretaryEmail);
  const item={id:Utilities.getUuid(),teamId:teamId,title:title,startAt:start.toISOString(),endAt:end.toISOString(),location:location,description:description,attendeeEmails:emails.join(','),secretaryEmail:allowed.indexOf(secretary)>=0?secretary:'',calendarEventId:created.id||'',meetUrl:(tool==='MEET'?created.hangoutLink:customUrl)||'',status:'ACTIVE',createdAt:now_(),createdBy:actor.email,mode:mode,onlineTool:tool,attendance:'{}'};
  append_(db,'Meetings',item);if(item.secretaryEmail)assignMeetingSecretary(token,item.id,item.secretaryEmail);
  let mailed=!ownMail&&!DV_.ma&&!lichLoi;if(ownMail){try{sendMeetingMail_(db,item,emails,members,actor);mailed=true}catch(e){mailed=false}}
  audit_(db,actor,'CREATE_MEETING',item.id);return Object.assign({},item,{mailed:mailed,lichGoogle:!DV_.ma&&!lichLoi});
}
function calendarCreate_(event,ownMail,tool,start,end){
  const cal=CalendarApp.getDefaultCalendar();
  const response=UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates='+(ownMail?'none':'all'),{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify(event),muteHttpExceptions:true});
  if(response.getResponseCode()<300)return JSON.parse(response.getContentText());
  if(tool==='MEET')throw new Error('Không tạo được lịch Google/Meet: '+response.getContentText().slice(0,300));
  // Họp trực tiếp / dán link: Google Calendar API chưa bật thì ghi lịch bằng CalendarApp (không cần bật API).
  const ev=cal.createEvent(event.summary,start,end,{description:event.description,location:event.location,guests:(event.attendees||[]).map(a=>a.email).join(','),sendInvites:!ownMail});
  return {id:ev.getId()};
}
// Admin chạy MỘT LẦN trong trình soạn thảo Apps Script: chọn hàm capQuyenLichGoogle → bấm Chạy → Cho phép.
// Sau đó lịch họp được ghi vào Google Lịch và tạo phòng Meet.
function capQuyenLichGoogle(){const c=CalendarApp.getDefaultCalendar();return 'Đã cấp quyền Google Lịch cho lịch: '+c.getName();}
function liveMeeting_(db,meetingId){const m=read_(db,'Meetings').find(x=>x.id===meetingId&&x.status!=='DELETED');if(!m)throw new Error('Không tìm thấy lịch họp.');return m;}
function requireTeamManager_(actor,db,teamId){if(actor.role==='LEADER'&&activeTeamId_(actor,db)!==teamId)throw new Error('Tổ trưởng chỉ được thao tác trên lịch họp của tổ mình.');}
function writeAttendance_(db,meetingId,mutate){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{return updateWhere_(db,'Meetings',x=>x.id===meetingId,x=>{let a={};try{a=JSON.parse(x.attendance||'{}')||{}}catch(e){}mutate(a);x.attendance=JSON.stringify(a);return x;}).attendance;}
  finally{lock.releaseLock();}
}
function respondAttendance(token,meetingId,status,note){
  const user=requireUser_(token),db=db_();ensureCollabSheets_(db);const m=liveMeeting_(db,meetingId);
  if(String(m.attendeeEmails).split(',').indexOf(user.email)<0)throw new Error('Cô/thầy không có trong danh sách mời của cuộc họp này.');
  status=status==='ABSENT'?'ABSENT':'PRESENT';note=cleanText_(note,300);
  if(status==='ABSENT'&&!note)throw new Error('Vui lòng ghi lý do vắng.');
  return {attendance:writeAttendance_(db,meetingId,a=>{a[user.email]={s:status,note:status==='ABSENT'?note:'',at:now_(),by:user.email}})};
}
function setAttendance(token,meetingId,list){
  const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);const m=liveMeeting_(db,meetingId);requireTeamManager_(actor,db,m.teamId);
  const invited=String(m.attendeeEmails).split(',');
  const out=writeAttendance_(db,meetingId,a=>{(Array.isArray(list)?list:[]).forEach(x=>{const email=cleanEmail_(x&&x.email);if(invited.indexOf(email)<0)return;if(x.status==='PRESENT'||x.status==='ABSENT')a[email]={s:x.status,note:cleanText_(x.note,300),at:now_(),by:actor.email};else delete a[email];})});
  audit_(db,actor,'SET_ATTENDANCE',meetingId);return {attendance:out};
}
function deleteMeeting(token,meetingId){
  const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);const m=liveMeeting_(db,meetingId);requireTeamManager_(actor,db,m.teamId);
  if(m.calendarEventId){try{UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/'+encodeURIComponent(m.calendarEventId)+'?sendUpdates=all',{method:'delete',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true})}catch(e){}}
  updateWhere_(db,'Meetings',x=>x.id===meetingId,x=>{x.status='DELETED';return x;});audit_(db,actor,'DELETE_MEETING',meetingId);return {deleted:true};
}

// ---------- Xóa biên bản ----------
function deleteMinutes(token,id){
  const u=requireUser_(token),db=db_(),item=read_(db,'Minutes').find(n=>n.id===id&&liveDoc_(n));if(!item)throw new Error('Không tìm thấy biên bản.');
  if(!canSeeMinutes_(u,item))throw new Error('Cô/thầy không có quyền xóa biên bản này.');
  [item.docId||fileIdFromUrl_(item.docUrl),fileIdFromUrl_(item.pdfUrl),fileIdFromUrl_(item.docxUrl),fileIdFromUrl_(item.secretarySignatureUrl),fileIdFromUrl_(item.principalSignatureUrl),fileIdFromUrl_(item.chairSignatureUrl),fileIdFromUrl_(item.attendeesSignatureUrl)].concat((()=>{try{return JSON.parse(item.memberSigns||'[]').map(m=>fileIdFromUrl_(m.signatureUrl))}catch(e){return []}})()).filter(Boolean).forEach(fid=>{try{DriveApp.getFileById(fid).setTrashed(true)}catch(e){}});
  updateWhere_(db,'Minutes',n=>n.id===id,n=>{n.status='DELETED';return n;});audit_(db,u,'DELETE_MINUTES',id);return {deleted:true};
}

// ---------- Đầu văn bản theo thể thức hành chính ----------
function fmt_(p,o){
  o=o||{};const A=DocumentApp.Attribute,H=DocumentApp.HorizontalAlignment,a={};
  a[A.FONT_FAMILY]='Times New Roman';a[A.FONT_SIZE]=o.size||13;a[A.BOLD]=!!o.bold;a[A.ITALIC]=!!o.italic;
  a[A.HORIZONTAL_ALIGNMENT]=o.align==='center'?H.CENTER:o.align==='right'?H.RIGHT:o.align==='justify'?H.JUSTIFY:H.LEFT;
  a[A.INDENT_START]=o.indent||0;a[A.INDENT_FIRST_LINE]=o.indent||0;a[A.SPACING_BEFORE]=o.before||0;a[A.SPACING_AFTER]=o.after||0;a[A.LINE_SPACING]=o.line||1.15;
  p.setAttributes(a);try{p.setAlignment(a[A.HORIZONTAL_ALIGNMENT])}catch(e){}return p;
}
function para_(parent,text,o){return fmt_(parent.appendParagraph(String(text||'')),o);}
function paras_(parent,text,o){String(text||'').split(/\r?\n/).forEach(line=>para_(parent,line,o));}
function pageSetup_(body){body.setPageWidth(595).setPageHeight(842).setMarginLeft(85).setMarginRight(43).setMarginTop(57).setMarginBottom(57);}
function fillCell_(cell,lines){
  cell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
  lines.forEach((x,i)=>{const p=i===0?cell.getChild(0).asParagraph():cell.appendParagraph('');p.setText(x.text||' ');fmt_(p,{size:x.size||12,bold:x.bold,align:'center',line:1});});
}
// Cụm cơ quan chủ quản/tên trường luôn nằm góc trên bên trái; biên bản có thêm Quốc hiệu, tiêu ngữ bên phải.
function docHeader_(body,o){
  o=o||{};const org=org_(),rule=n=>({text:new Array(n+1).join('_'),size:6});
  // Cột trái của biên bản hẹp: tên cơ quan chủ quản dài thì ngắt thành hai dòng cân đối.
  let authority=[org.authority];
  if(o.national&&org.authority.length>26){const m=org.authority.match(/^(ỦY BAN NHÂN DÂN|UỶ BAN NHÂN DÂN|SỞ GIÁO DỤC VÀ ĐÀO TẠO|PHÒNG GIÁO DỤC VÀ ĐÀO TẠO)\s+(.+)$/);if(m)authority=[m[1],m[2]];else{const mid=org.authority.lastIndexOf(' ',Math.ceil(org.authority.length/2));if(mid>0)authority=[org.authority.slice(0,mid),org.authority.slice(mid+1)];}}
  const left=authority.map(t=>({text:t,size:12})).concat([{text:org.school,size:12,bold:true},rule(24)]);if(o.team){left.push({text:' ',size:3});left.push({text:o.team,size:12,bold:true});}
  const right=o.national?[{text:'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',size:12,bold:true},{text:'Độc lập - Tự do - Hạnh phúc',size:13,bold:true},rule(52)]:[{text:' ',size:12}];
  const table=body.insertTable(0,[['','']]);table.setBorderWidth(0);
  table.setColumnWidth(0,o.national?212:300);table.setColumnWidth(1,o.national?255:167);
  fillCell_(table.getCell(0,0),left);fillCell_(table.getCell(0,1),right);
  fmt_(body.getChild(1).asParagraph(),{size:6});
}
// Hàng chữ ký: chức danh, chữ ký, họ tên nằm thẳng hàng giữa các cột.
function signRow_(body,cols,widths){
  const table=body.appendTable([cols.map(c=>c[0]),cols.map(()=>' '),cols.map(c=>c[2]||' ')]);table.setBorderWidth(0);
  widths.forEach((w,i)=>table.setColumnWidth(i,w));table.getRow(1).setMinimumHeight(58);
  cols.forEach((c,i)=>{
    fmt_(table.getCell(0,i).getChild(0).asParagraph(),{bold:true,align:'center',size:12});
    const mid=fmt_(table.getCell(1,i).getChild(0).asParagraph(),{align:'center'});
    if(c[1]){try{const blob=signatureBlob_(c[1]);if(blob){const img=mid.appendInlineImage(blob),w=img.getWidth(),h=img.getHeight(),k=Math.min(120/w,52/h,1);img.setWidth(Math.round(w*k)).setHeight(Math.round(h*k));}}catch(e){}}
    fmt_(table.getCell(2,i).getChild(0).asParagraph(),{bold:true,align:'center'});
  });
}
function labelLine_(body,label,value){const p=para_(body,'',{align:'justify'});p.appendText(label+': ').setFontFamily('Times New Roman').setFontSize(13).setBold(true);p.appendText(String(value||' ')).setFontFamily('Times New Roman').setFontSize(13).setBold(false);return p;}
function signCell_(cell,title,url,name){
  const head=cell.getChild(0).asParagraph();head.setText(title);fmt_(head,{bold:true,align:'center'});
  if(url){try{const blob=signatureBlob_(url);if(blob){const p=fmt_(cell.appendParagraph(''),{align:'center'});p.appendInlineImage(blob).setWidth(110).setHeight(55);}}catch(e){}}
  else{para_(cell,' ',{align:'center'});para_(cell,' ',{align:'center'});para_(cell,' ',{align:'center'});}
  para_(cell,name||' ',{bold:true,align:'center'});
}
function createMeetingMinutesDoc_(item){
  const doc=DocumentApp.create(safeFile_(item.title)),body=doc.getBody(),db=db_();pageSetup_(body);
  docHeader_(body,{team:teamName_(db,item.teamId||'to-4').toUpperCase(),national:true});
  para_(body,'BIÊN BẢN HỌP TỔ CHUYÊN MÔN',{bold:true,size:14,align:'center',before:14});
  para_(body,item.title,{bold:true,align:'center',after:10});
  [['Thời gian',item.meetingTime],['Địa điểm',item.location||'........................................'],['Người chủ trì',item.chair],['Thư ký',item.secretary],['Thành phần tham dự',item.attendees||'........................................']].forEach(x=>labelLine_(body,x[0],x[1]));
  [['I. Nội dung cuộc họp',item.agenda],['II. Nội dung nghiên cứu bài học/chuyên đề',item.researchTopic||'Không có.'],['III. Minh chứng và biểu hiện học tập của học sinh',item.evidence||'Không có.'],['IV. Ý kiến thảo luận',item.discussion],['V. Kết luận của chủ trì',item.conclusion],['VI. Phân công và thời hạn thực hiện',item.assignments||'Không có.']].forEach(x=>{para_(body,x[0],{bold:true,before:8});paras_(body,x[1],{align:'justify'});});
  para_(body,'Cuộc họp kết thúc lúc '+(item.endHour||'....')+' giờ '+(item.endMinute||'....')+' phút cùng ngày. Tất cả các thành viên tham gia dự họp thống nhất với nội dung cuộc họp./.',{align:'justify',before:8,after:12});
  signRow_(body,[['THƯ KÝ',item.secretarySignatureUrl,item.secretary],['ĐẠI DIỆN BAN GIÁM HIỆU',item.principalSignatureUrl,item.principalRepresentative||''],['CHỦ TRÌ',item.chairSignatureUrl,item.chair]],[135,197,135]);
  membersTable_(body,item);
  doc.saveAndClose();DriveApp.getFileById(doc.getId()).moveTo(folder_('minutes'));dvChiaSe_(doc.getId());return doc;
}
function createNotebookDoc_(item) {
  const fileName=safeFile_(item.title||String(item.content||'').slice(0,80)||'Sổ họp'),doc=DocumentApp.create(fileName),body=doc.getBody();pageSetup_(body);
  docHeader_(body,{national:false});
  para_(body,'SỔ HỌP '+String(item.title).toUpperCase(),{bold:true,size:14,align:'center',before:14,after:6});
  para_(body,'Thời gian: '+item.meetingTime,{align:'center'});para_(body,'Người chủ trì: '+item.chair,{align:'center'});
  labelLine_(body,'Người dự họp',item.attendees||'........................................................');
  para_(body,'Nội dung',{bold:true,align:'center',before:8,after:4});paras_(body,item.content,{align:'justify'});
  const sign=body.appendTable([['','']]);sign.setBorderWidth(0);fmt_(sign.getCell(0,0).getChild(0).asParagraph(),{});
  signCell_(sign.getCell(0,1),'Giáo viên',item.signatureUrl,item.ownerName);
  doc.saveAndClose();DriveApp.getFileById(doc.getId()).moveTo(folder_('notebooks'));dvChiaSe_(doc.getId());return doc;
}

// Release 35: trợ lý AI nhiều lượt cho Nghiên cứu bài học và trợ lý văn bản đa nhiệm; xuất Google Docs/PDF, lưu Drive 365 ngày.
const TH50_AI_MODEL='gemini-3.8-flash';
const TH50_RESEARCH_STEPS=['Xác định vấn đề','Chuẩn bị bài học nghiên cứu','Dạy minh họa và quan sát','Phân tích và điều chỉnh','Lưu trữ và chia sẻ'];
let AI_SHEETS_READY_=false;
function aiSheets_(db){
  if(AI_SHEETS_READY_)return;
  sheet_(db,'AiUploads',['id','ownerEmail','mode','name','mime','kind','fileId','createdAt','expiresAt','status']);
  sheet_(db,'AiDocs',['id','ownerEmail','ownerName','teamId','mode','title','createdAt','expiresAt','status','docId','docUrl','pdfUrl','fileType']);
  AI_SHEETS_READY_=true;
}
function aiDocsFor_(db,user){aiSheets_(db);return read_(db,'AiDocs').filter(n=>liveDoc_(n)&&(user.role==='ADMIN'||n.ownerEmail===user.email)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}

// Word được chuyển tạm sang Google Docs để lấy phần chữ, sau đó bản tạm vào Thùng rác.
function wordToText_(bytes,name,ext){
  const mime=ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/msword',boundary='th50'+Utilities.getUuid();
  const head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:'[tạm] '+name,mimeType:'application/vnd.google-apps.document'})+'\r\n--'+boundary+'\r\nContent-Type: '+mime+'\r\n\r\n';
  const payload=Utilities.newBlob(head).getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--'+boundary+'--').getBytes());
  const r=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'post',contentType:'multipart/related; boundary='+boundary,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:payload,muteHttpExceptions:true});
  if(r.getResponseCode()>=300)throw new Error('Không đọc được tệp Word. Cô/thầy vui lòng lưu thành PDF rồi tải lại.');
  const id=JSON.parse(r.getContentText()).id;
  try{return DocumentApp.openById(id).getBody().getText();}finally{try{DriveApp.getFileById(id).setTrashed(true)}catch(e){}}
}
function aiUpload(token,input){
  const u=requireUser_(token),db=db_();aiSheets_(db);input=input||{};
  const m=String(input.dataUrl||'').match(/^data:([^;,]*);base64,([A-Za-z0-9+\/=]+)$/);if(!m)throw new Error('Tệp tải lên không hợp lệ.');
  if(m[2].length>11500000)throw new Error('Tệp quá lớn. Vui lòng dùng tệp dưới khoảng 8 MB.');
  const name=cleanText_(input.name,150)||'tai-lieu',ext=((name.match(/\.([A-Za-z0-9]+)$/)||[])[1]||'').toLowerCase(),bytes=Utilities.base64Decode(m[2]);
  const inline={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
  let kind,mime,file;
  if(inline[ext]){kind='INLINE';mime=inline[ext];file=folder_('aiUploads').createFile(Utilities.newBlob(bytes,mime,name));}
  else{
    let text='';
    if(ext==='txt')text=Utilities.newBlob(bytes).getDataAsString('UTF-8');
    else if(ext==='docx'||ext==='doc')text=wordToText_(bytes,name,ext);
    else throw new Error('Chỉ hỗ trợ tệp PDF, ảnh PNG/JPG/WebP, Word (.docx, .doc) hoặc văn bản .txt.');
    text=String(text).trim();if(!text)throw new Error('Không đọc được nội dung trong tệp.');
    kind='TEXT';mime='text/plain';file=folder_('aiUploads').createFile(Utilities.newBlob(text.slice(0,200000),'text/plain',name+'.txt'));
  }
  const item={id:Utilities.getUuid(),ownerEmail:u.email,mode:input.mode==='text'?'text':'research',name:name,mime:mime,kind:kind,fileId:file.getId(),createdAt:now_(),expiresAt:expiry_(),status:'ACTIVE'};
  append_(db,'AiUploads',item);audit_(db,u,'AI_UPLOAD',item.id);return {uploadId:item.id,name:name,kind:kind};
}

function aiInstruction_(mode){
  const common=' Luôn trả lời bằng tiếng Việt, đầy đủ, chính xác và đi thẳng vào câu hỏi của người dùng. Chỉ dựa trên tài liệu người dùng cung cấp và kiến thức chắc chắn; nếu tài liệu không có thông tin hoặc bạn không chắc thì nói rõ, tuyệt đối không bịa số liệu, số hiệu văn bản hay trích dẫn. Viết hoa đúng quy tắc tiếng Việt: chỉ viết hoa chữ đầu câu, đầu tiêu đề và tên riêng, không viết hoa chữ đầu của mỗi từ. Trình bày bằng tiêu đề ngắn (bắt đầu bằng ##) và gạch đầu dòng; không dùng bảng Markdown.';
  if(mode==='text')return 'Bạn là trợ lý đa nhiệm xử lý văn bản cho giáo viên và cán bộ quản lý trường tiểu học Việt Nam. Bạn đọc kỹ văn bản người dùng đưa vào, xác định loại văn bản, cơ quan ban hành, mục đích, các yêu cầu, thời hạn và việc cần làm; rồi hỗ trợ theo đúng điều người dùng chọn: tóm tắt, lập danh sách việc cần làm, phân tích yêu cầu, dự thảo văn bản trả lời/kế hoạch triển khai, rà soát lỗi, hoặc việc khác người dùng nêu. Trao đổi cho đến khi người dùng đồng ý.'+common;
  return 'Bạn là trợ lý nghiên cứu bài học cho tổ chuyên môn trường tiểu học Việt Nam, làm việc theo định hướng sinh hoạt chuyên môn dựa trên nghiên cứu bài học của Công văn 4069/BGDĐT-GDPT: lấy hoạt động học và sự tiến bộ của học sinh làm trung tâm; thiết thực, linh hoạt, không hành chính hóa; ưu tiên lưu trữ và chia sẻ trên môi trường số; không đánh giá, không xếp loại giáo viên hay giờ dạy. Quy trình gồm 5 bước: '+TH50_RESEARCH_STEPS.map((s,i)=>'Bước '+(i+1)+': '+s).join('; ')+'. Cách làm việc: mỗi lượt chỉ làm MỘT bước và ghi rõ tên bước ở đầu; phân tích bám sát tài liệu (kế hoạch bài dạy, trang sách giáo khoa hoặc ảnh chụp) và nêu chi tiết cụ thể trong tài liệu làm căn cứ; đưa đề xuất cụ thể, làm được ngay trên lớp (mục tiêu, hoạt động học, câu hỏi, minh chứng cần quan sát ở học sinh, phương án hỗ trợ học sinh khó khăn và học sinh có năng khiếu); cuối lượt hỏi người dùng đồng ý hay cần chỉnh gì. Chỉ chuyển sang bước sau khi người dùng đồng ý. Khi người dùng hỏi bất kỳ câu nào, trả lời trọn vẹn câu hỏi đó trước rồi mới quay lại bước đang làm.'+common;
}
function aiModels_(key){
  const r=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(key),{muteHttpExceptions:true});if(r.getResponseCode()>=300)return [];
  const version=n=>(n.match(/gemini-(\d+)(?:\.(\d+))?/)||[]).slice(1).map(x=>Number(x||0)),lite=n=>/-lite$/.test(n)?1:0;
  const names=(JSON.parse(r.getContentText()).models||[]).filter(m=>(m.supportedGenerationMethods||[]).indexOf('generateContent')>=0).map(m=>String(m.name).replace(/^models\//,'')).filter(n=>/^gemini-[\d.]+-flash(-lite)?$/.test(n));
  return names.sort((a,b)=>{const x=version(a),y=version(b);return (y[0]-x[0])||((y[1]||0)-(x[1]||0))||(lite(a)-lite(b));});
}
function aiPickModel_(key){return aiModels_(key)[0]||'';}
function aiSource_(db,u,input){
  const source=[];
  if(input.uploadId){
    aiSheets_(db);const up=read_(db,'AiUploads').find(x=>x.id===input.uploadId&&x.ownerEmail===u.email&&x.status==='ACTIVE');if(!up)throw new Error('Không tìm thấy tài liệu đã tải lên. Cô/thầy vui lòng tải lại.');
    const blob=DriveApp.getFileById(up.fileId).getBlob();
    if(up.kind==='INLINE')source.push({inlineData:{mimeType:up.mime,data:Utilities.base64Encode(blob.getBytes())}});else source.push({text:'TÀI LIỆU NGƯỜI DÙNG TẢI LÊN ('+up.name+'):\n'+blob.getDataAsString('UTF-8')});
  }
  const pasted=String(input.pasted||'').trim().slice(0,60000);if(pasted)source.push({text:'NỘI DUNG NGƯỜI DÙNG DÁN VÀO:\n'+pasted});
  return source;
}
function geminiGenerate_(request,key){
  const props=P_();
  const cache=CacheService.getScriptCache(),payload=JSON.stringify(request),preferred=props.getProperty('GEMINI_MODEL')||TH50_AI_MODEL,trail=[];
  const ask=name=>UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/'+name+':generateContent?key='+encodeURIComponent(key),{method:'post',contentType:'application/json',payload:payload,muteHttpExceptions:true});
  // Thứ tự thử: mô hình cài sẵn trước; mô hình vừa báo quá tải trong 10 phút gần đây thì xếp xuống cuối.
  let list=[preferred],listed=false,response=null,model='',code=0,missing=false;
  const extend=()=>{if(listed)return;listed=true;aiModels_(key).forEach(n=>{if(list.indexOf(n)<0)list.push(n)});};
  if(cache.get('aiBusy:'+preferred)){extend();const busy=cache.getAll(list.map(n=>'aiBusy:'+n));list=list.filter(n=>!busy['aiBusy:'+n]).concat(list.filter(n=>busy['aiBusy:'+n]));}
  for(let i=0;i<list.length&&i<5;i++){
    model=list[i];response=ask(model);code=response.getResponseCode();
    if(code===500||code===503){Utilities.sleep(2500);response=ask(model);code=response.getResponseCode();}
    trail.push(model+':'+code);
    if(code<300)break;
    if(code===400&&/API key not valid|API_KEY_INVALID/.test(response.getContentText()))break;
    if(code===404&&model===preferred)missing=true;
    if(code===429||code===500||code===503)cache.put('aiBusy:'+model,'1',600);
    if([400,404,429,500,503].indexOf(code)<0)break;
    extend();
  }
  if(code<300&&missing)props.setProperty('GEMINI_MODEL',model);
  if(code===503||code===500)throw new Error('Máy chủ Gemini đang quá tải. Cô/thầy vui lòng bấm lại sau ít phút.');
  if(code===429)throw new Error('Khóa Gemini đã hết hạn mức sử dụng lúc này. Cô/thầy vui lòng thử lại sau, hoặc báo Admin kiểm tra hạn mức của khóa.');
  if(code===400&&/API key not valid|API_KEY_INVALID/.test(response.getContentText()))throw new Error('Khóa Gemini không hợp lệ. Admin vui lòng nhập lại khóa trong Cài đặt.');
  if(code>=300)throw new Error('Gemini chưa phản hồi ('+trail.join(', ')+'): '+response.getContentText().slice(0,300));
  const body=JSON.parse(response.getContentText()),cand=(body.candidates||[])[0]||{},answer=cand.content,text=((answer&&answer.parts)||[]).filter(p=>!p.thought).map(p=>p.text||'').join('\n').trim();
  if(!text)throw new Error('Gemini chưa tạo được nội dung. Cô/thầy vui lòng thử lại hoặc dùng tệp nhỏ hơn.');
  return {text:text,model:model,finish:String(cand.finishReason||''),trail:trail.join(', ')};
}
function aiChat(token,input){
  const u=requireUser_(token),db=db_();input=input||{};
  const key=requireAiKey_(u);
  const mode=input.mode==='text'?'text':'research',task=['start','suggest','compile'].indexOf(input.task)>=0?input.task:'chat';
  let total=0,history=(Array.isArray(input.history)?input.history:[]).map(h=>({role:h&&h.role==='model'?'model':'user',text:String(h&&h.text||'').slice(0,30000)})).filter(h=>h.text);
  history=history.reverse().filter(h=>(total+=h.text.length)<=120000).reverse();while(history.length&&history[0].role!=='user')history.shift();
  let message=String(input.message||'').trim().slice(0,8000);
  if(task==='start')message='Hãy đọc kỹ tài liệu tôi cung cấp, nêu ngắn gọn bài học/chủ đề bạn nhận ra được, rồi thực hiện Bước 1: '+TH50_RESEARCH_STEPS[0]+'.'+(message?' Lưu ý của tôi: '+message:'');
  else if(task==='suggest')message='Hãy đọc kỹ văn bản tôi cung cấp. Trả về JSON đúng dạng {"docType":"loại văn bản","summary":"tóm tắt 3-5 câu: ai ban hành, về việc gì, yêu cầu chính, thời hạn nếu có","suggestions":["5 đến 6 việc cụ thể, mỗi việc dưới 15 từ, mà người dùng nhiều khả năng cần bạn phân tích hoặc soạn giúp từ văn bản này"]}. Không thêm chữ nào ngoài JSON.';
  else if(task==='compile')message=(mode==='text'?'Hãy tổng hợp các nội dung đã thống nhất thành MỘT văn bản hoàn chỉnh, sẵn sàng sử dụng.':'Hãy tổng hợp toàn bộ nội dung đã thống nhất ở các bước thành MỘT hồ sơ nghiên cứu bài học hoàn chỉnh, theo đúng thứ tự 5 bước, kèm minh chứng cần quan sát và nội dung điều chỉnh bài học.')+' Chỉ viết nội dung văn bản, không chào hỏi, không hỏi lại.'+(message?' Yêu cầu thêm: '+message:'');
  if(!message)throw new Error('Vui lòng nhập câu hỏi hoặc yêu cầu.');
  const source=aiSource_(db,u,input);
  if(!source.length&&task!=='chat'&&!history.length)throw new Error('Vui lòng tải tệp hoặc dán nội dung trước.');
  const contents=history.concat([{role:'user',text:message}]).map(h=>({role:h.role,parts:[{text:h.text}]}));
  contents[0].parts=source.concat(contents[0].parts);
  const config={temperature:0.3,maxOutputTokens:8192};if(task==='suggest')config.responseMimeType='application/json';
  const made=geminiGenerate_({systemInstruction:{parts:[{text:aiInstruction_(mode)}]},contents:contents,generationConfig:config},key),text=made.text,model=made.model;
  audit_(db,u,'AI_'+mode.toUpperCase()+'_'+task.toUpperCase(),model);
  if(task!=='suggest')return {text:text,model:model};
  let parsed={};try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''))||{}}catch(e){parsed={summary:text}}
  return {docType:String(parsed.docType||''),summary:String(parsed.summary||''),suggestions:(Array.isArray(parsed.suggestions)?parsed.suggestions:[]).map(String).filter(Boolean).slice(0,6),model:model};
}

function richPara_(body,text,o){
  o=o||{};const p=para_(body,'',o);
  String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).forEach(seg=>{const bold=/^\*\*[^*]+\*\*$/.test(seg);p.appendText(bold?seg.slice(2,-2):seg).setFontFamily('Times New Roman').setFontSize(o.size||13).setBold(bold||!!o.bold);});
  return p;
}
function markdownToDoc_(body,content){
  String(content).split(/\r?\n/).forEach(line=>{
    const t=line.trim();if(!t||/^[-_*]{3,}$/.test(t))return;let m;
    if((m=t.match(/^#{1,6}\s+(.*)$/)))richPara_(body,m[1].replace(/\*\*/g,''),{bold:true,before:8});
    else if((m=t.match(/^[-*•+]\s+(.*)$/)))richPara_(body,'– '+m[1],{align:'justify',indent:18});
    else richPara_(body,t,{align:'justify'});
  });
}
function aiPdf_(docId,title){const f=folder_('aiDocs').createFile(DriveApp.getFileById(docId).getAs(MimeType.PDF).setName(safeFile_(title)+'.pdf'));dvChiaSe_(f.getId());return f;}
function aiExport(token,input){
  const u=requireUser_(token),db=db_();aiSheets_(db);ensureCollabSheets_(db);input=input||{};
  const mode=['text','lesson'].indexOf(input.mode)>=0?input.mode:'research',title=cleanText_(input.title,160),content=String(input.content||'').trim().slice(0,100000);
  if(!title||!content)throw new Error('Vui lòng nhập tên văn bản và nội dung trước khi xuất.');
  const doc=DocumentApp.create(safeFile_(title)),body=doc.getBody();pageSetup_(body);docHeader_(body,{national:false});
  para_(body,title.toUpperCase(),{bold:true,size:14,align:'center',before:14,after:10});
  markdownToDoc_(body,content);
  para_(body,' ',{});const sign=body.appendTable([['','']]);sign.setBorderWidth(0);fmt_(sign.getCell(0,0).getChild(0).asParagraph(),{});signCell_(sign.getCell(0,1),'Người thực hiện','',u.name);
  doc.saveAndClose();DriveApp.getFileById(doc.getId()).moveTo(folder_('aiDocs'));dvChiaSe_(doc.getId());
  const item={id:Utilities.getUuid(),ownerEmail:u.email,ownerName:u.name,teamId:activeTeamId_(u,db),mode:mode,title:title,createdAt:now_(),expiresAt:expiry_(),status:'ACTIVE',docId:doc.getId(),docUrl:doc.getUrl(),pdfUrl:''};
  if(input.format==='PDF')item.pdfUrl=aiPdf_(item.docId,title).getUrl();
  append_(db,'AiDocs',item);audit_(db,u,'AI_EXPORT_'+(input.format==='PDF'?'PDF':'DOC'),item.id);return item;
}
function ownAiDoc_(db,u,id){aiSheets_(db);const item=read_(db,'AiDocs').find(n=>n.id===id&&liveDoc_(n)&&(u.role==='ADMIN'||n.ownerEmail===u.email));if(!item)throw new Error('Không tìm thấy văn bản.');return item;}
function exportAiDocPdf(token,id){const u=requireUser_(token),db=db_(),item=ownAiDoc_(db,u,id),pdf=aiPdf_(item.docId,item.title);updateWhere_(db,'AiDocs',r=>r.id===id,r=>{r.pdfUrl=pdf.getUrl();return r;});audit_(db,u,'AI_EXPORT_PDF',id);return {pdfUrl:pdf.getUrl()};}
function deleteAiDoc(token,id){
  const u=requireUser_(token),db=db_(),item=ownAiDoc_(db,u,id);
  [item.docId,fileIdFromUrl_(item.pdfUrl)].filter(Boolean).forEach(fid=>{try{DriveApp.getFileById(fid).setTrashed(true)}catch(e){}});
  updateWhere_(db,'AiDocs',n=>n.id===id,n=>{n.status='DELETED';return n;});audit_(db,u,'AI_DELETE_DOC',id);return {deleted:true};
}

// Release 36: danh sách từng thành viên dự họp kèm chữ ký trong biên bản; thành viên vắng ghi rõ lý do.
function memberSigns_(user,list){
  return JSON.stringify((Array.isArray(list)?list:[]).slice(0,60).map(x=>{x=x||{};const absent=!!x.absent;return {email:cleanEmail_(x.email),name:cleanText_(x.name,100),absent:absent,note:absent?cleanText_(x.note,300):'',signatureUrl:x.signatureData&&!absent?saveSignature_(user,x.signatureData):''};}).filter(x=>x.name));
}
function membersTable_(body,item){
  let list=[];try{list=JSON.parse(item.memberSigns||'[]')||[]}catch(e){}
  para_(body,'CÁC THÀNH VIÊN DỰ HỌP',{bold:true,before:12,after:6});
  if(!list.length){if(item.attendeesSignatureUrl){try{const blob=signatureBlob_(item.attendeesSignatureUrl);if(blob)body.appendImage(blob).setWidth(220)}catch(e){}}return;}
  const table=body.appendTable([['STT','Họ và tên','Chữ ký']].concat(list.map((m,i)=>[String(i+1),m.name,m.absent?'Vắng'+(m.note?' ('+m.note+')':''):' '])));
  table.setColumnWidth(0,40);table.setColumnWidth(1,230);table.setColumnWidth(2,192);
  for(let r=0;r<table.getNumRows();r++)for(let c=0;c<3;c++)fmt_(table.getCell(r,c).getChild(0).asParagraph(),{bold:r===0,align:c===1&&r>0?'left':'center',italic:r>0&&c===2});
  list.forEach((m,i)=>{
    if(m.absent||!m.signatureUrl)return;
    try{const blob=signatureBlob_(m.signatureUrl);if(!blob)return;const img=table.getCell(i+1,2).getChild(0).asParagraph().appendInlineImage(blob),w=img.getWidth(),h=img.getHeight(),k=Math.min(110/w,42/h,1);img.setWidth(Math.round(w*k)).setHeight(Math.round(h*k));}catch(e){}
  });
}

// Release 37: Bài giảng tương tác — Gemini tạo sản phẩm; mã HTML tải về .html, văn bản xuất Google Docs/PDF.
const TH50_LESSON_KINDS={
  game:{type:'html',name:'trò chơi học tập tương tác',brief:'Một trò chơi học tập có luật chơi rõ ràng, nhiều lượt chơi, tính điểm, có phản hồi đúng/sai ngay và màn hình tổng kết; có nút chơi lại.'},
  quiz:{type:'html',name:'bài trắc nghiệm tự chấm điểm',brief:'Bài trắc nghiệm 8-10 câu, mỗi câu 3-4 lựa chọn, hiện đúng/sai và lời giải thích ngắn sau mỗi câu, cuối bài hiện tổng điểm và nút làm lại.'},
  slides:{type:'html',name:'bài giảng trình chiếu tương tác',brief:'Bài trình chiếu 8-12 trang chuyển bằng nút và phím mũi tên: khởi động, khám phá kiến thức, luyện tập có câu hỏi bấm để hiện đáp án, vận dụng, tổng kết.'},
  worksheet:{type:'text',name:'phiếu học tập',brief:'Phiếu học tập cho học sinh: mục tiêu ngắn, các bài tập từ dễ đến khó có chỗ trống để làm bài, phần tự đánh giá; kèm đáp án cho giáo viên ở cuối.'},
  questions:{type:'text',name:'bộ câu hỏi và đáp án',brief:'Bộ câu hỏi theo các mức nhận biết, thông hiểu, vận dụng; mỗi câu có đáp án và gợi ý chấm.'}
};
function lessonInstruction_(kind){
  const base='Bạn là chuyên gia thiết kế học liệu cho học sinh tiểu học Việt Nam. Nội dung phải đúng kiến thức, đúng với tài liệu và yêu cầu của giáo viên, ngôn ngữ tiếng Việt chuẩn, phù hợp lứa tuổi; không bịa nội dung ngoài bài học. CHÍNH TẢ: viết hoa đúng quy tắc tiếng Việt, chỉ viết hoa chữ đầu câu, đầu tiêu đề và tên riêng (viết \"Trò chơi vui nhộn\", không viết \"Trò Chơi Vui Nhộn\"); không dùng text-transform: capitalize. ';
  if(kind.type==='html')return base+'Sản phẩm là MỘT tệp HTML hoàn chỉnh chạy được ngay khi mở bằng trình duyệt, không cần mạng: toàn bộ CSS và JavaScript viết trong tệp, không dùng thư viện, phông chữ, hình ảnh hay liên kết bên ngoài (dùng emoji, CSS và SVG vẽ trong tệp). Giao diện tươi sáng, chữ to dễ đọc trên máy chiếu và máy tính bảng, nút bấm lớn, tự co giãn theo màn hình. Có tiêu đề bài học và hướng dẫn ngắn. Mã phải đầy đủ, không bỏ dở, không ghi chú kiểu "phần còn lại tương tự". Chỉ trả về mã HTML bắt đầu bằng <!DOCTYPE html>, không thêm lời giải thích, không bọc trong dấu ```.';
  return base+'Sản phẩm là văn bản để in. Trình bày bằng tiêu đề ngắn (bắt đầu bằng ##) và gạch đầu dòng; không dùng bảng Markdown; không chào hỏi, không hỏi lại.';
}
function aiLesson(token,input){
  const u=requireUser_(token),db=db_();input=input||{};
  const kindId=TH50_LESSON_KINDS[input.kind]?input.kind:'game',kind=TH50_LESSON_KINDS[kindId];
  const f=(k,n)=>cleanText_(input[k],n),grade=f('grade',20),subject=f('subject',60),week=f('week',20),lesson=f('lesson',200),idea=String(input.idea||'').trim().slice(0,3000);
  if(!lesson)throw new Error('Vui lòng nhập tên bài học.');
  const aiKey=requireAiKey_(u);
  const source=aiSource_(db,u,input);
  const request='Hãy tạo '+kind.name+' cho bài học sau.\n- Lớp: '+(grade||'tiểu học')+'\n- Môn: '+(subject||'(không ghi)')+(week?'\n- Tuần: '+week:'')+'\n- Bài: '+lesson+'\n- Yêu cầu sản phẩm: '+kind.brief+(idea?'\n- Ý tưởng và yêu cầu riêng của giáo viên: '+idea:'')+(source.length?'\nBám sát tài liệu giáo viên cung cấp kèm theo.':'');
  const contents=[{role:'user',parts:source.concat([{text:request}])}];
  const current=String(input.current||'').slice(0,90000),change=String(input.message||'').trim().slice(0,4000);
  if(current&&change){contents.push({role:'model',parts:[{text:current}]});contents.push({role:'user',parts:[{text:'Hãy chỉnh sửa sản phẩm trên theo yêu cầu sau và trả về TOÀN BỘ sản phẩm đã chỉnh (không chỉ phần thay đổi): '+change}]});}
  const r=geminiGenerate_({systemInstruction:{parts:[{text:lessonInstruction_(kind)}]},contents:contents,generationConfig:{temperature:0.5,maxOutputTokens:kind.type==='html'?32000:8192}},aiKey);
  let text=r.text;
  if(kind.type==='html'){
    text=text.replace(/^```(?:html)?\s*/i,'').replace(/\s*```\s*$/,'').trim();const at=text.search(/<!doctype html|<html/i);if(at>0)text=text.slice(at);
    if(!/<html[\s>]/i.test(text)||!/<\/html>\s*$/i.test(text))throw new Error(r.finish==='MAX_TOKENS'?'Sản phẩm quá dài nên bị cắt giữa chừng. Cô/thầy vui lòng yêu cầu đơn giản hơn (ít câu hỏi, ít trang hơn) rồi tạo lại.':'Gemini chưa trả về tệp HTML hoàn chỉnh. Cô/thầy vui lòng bấm tạo lại.');
  }
  audit_(db,u,'AI_LESSON_'+kindId.toUpperCase(),r.model);return {type:kind.type,kind:kindId,content:text,model:r.model};
}
function aiSaveHtml(token,input){
  const u=requireUser_(token),db=db_();aiSheets_(db);ensureCollabSheets_(db);input=input||{};
  const title=cleanText_(input.title,160),html=String(input.html||'');
  if(!title||!/<html[\s>]/i.test(html))throw new Error('Chưa có sản phẩm HTML để lưu.');
  if(html.length>600000)throw new Error('Tệp HTML quá lớn để lưu.');
  const file=folder_('aiDocs').createFile(Utilities.newBlob(html,'text/html',safeFile_(title)+'.html'));dvChiaSe_(file.getId());
  const item={id:Utilities.getUuid(),ownerEmail:u.email,ownerName:u.name,teamId:activeTeamId_(u,db),mode:'lesson',title:title,createdAt:now_(),expiresAt:expiry_(),status:'ACTIVE',docId:file.getId(),docUrl:file.getUrl(),pdfUrl:'',fileType:'HTML'};
  append_(db,'AiDocs',item);audit_(db,u,'AI_SAVE_HTML',item.id);return item;
}

// Release 38: mỗi người dùng tự nhập khóa Gemini của mình. Khóa lưu trong Script Properties (không nằm trong Sheet),
// không bao giờ gửi ngược về trình duyệt. Tài khoản Admin dùng khóa chung nhập ở Cài đặt.
let AI_PROPS_=null;
function userAiKeyName_(u){return u.role==='ADMIN'?'GEMINI_API_KEY':'gkey:'+digest_(u.email);}
function userAiKey_(u){if(!AI_PROPS_)AI_PROPS_=P_().getProperties();return AI_PROPS_[userAiKeyName_(u)]||'';}
function requireAiKey_(u){const key=userAiKey_(u);if(!key)throw new Error('Cô/thầy chưa nhập khóa Gemini của mình. Bấm vào tên ở góc phải trên, chọn Thông tin cá nhân để dán khóa.');return key;}
function setMyGeminiKey(token,key){
  const u=requireUser_(token),props=P_();key=String(key||'').trim();
  if(!key){props.deleteProperty(userAiKeyName_(u));AI_PROPS_=null;audit_(db_(),u,'CLEAR_AI_KEY',u.email);return {hasAiKey:false};}
  if(key.length<20||key.length>200||/\s/.test(key))throw new Error('Khóa Gemini chưa đúng. Cô/thầy dán lại nguyên khóa.');
  const r=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key='+encodeURIComponent(key),{muteHttpExceptions:true});
  if(r.getResponseCode()===400||r.getResponseCode()===401||r.getResponseCode()===403)throw new Error('Google báo khóa này không hợp lệ. Cô/thầy kiểm tra lại khóa tại aistudio.google.com/apikey.');
  props.setProperty(userAiKeyName_(u),key);AI_PROPS_=null;audit_(db_(),u,'SET_AI_KEY',u.email);return {hasAiKey:true};
}

// ============================================================
// Release 40: DỰ ÁN TỔNG – nhiều đơn vị (trường hoặc tổ chuyên môn) dùng chung một trang.
// - Link không có mã = đơn vị gốc (Trường Tiểu học Trương Định), không đổi gì.
// - Link ?truong=<mã> = đơn vị đăng ký. Dữ liệu nằm trong MỘT Google Sheet do đơn vị sở hữu (bản sao của Sheet mẫu),
//   chia sẻ quyền chỉnh sửa cho tài khoản hệ thống. Hệ thống không nhận thư mục Drive và không giữ mật khẩu của ai.
// - Link ?trang=cong-dong = trang dự án tổng (giới thiệu, điều khoản, đăng ký, Admin dự án).
// - Đăng ký và đăng nhập đều bằng mã gửi về email của chính người dùng; chỉ tài khoản đã được duyệt mới kích hoạt được.
// - Tệp xuất ra (Google Docs/PDF/Word/HTML) của đơn vị đăng ký chỉ để tạm trong Drive của hệ thống 30 ngày;
//   nội dung sổ họp, biên bản vẫn nằm trong Sheet của đơn vị và tạo lại tệp được.
// ============================================================
const DV_LINK='https://script.google.com/macros/s/AKfycbxXjH7Qsu4TxMnzryqURclEMRcud89vq3TV5wP-xotKiojMYvVkrjYPCB5AHQWUaFdF/exec';
let DV_PREFIX=''; // bản thử dùng tiền tố khác để không dùng chung sổ đăng ký và mật khẩu Admin dự án với bản thật
let DV_={ma:'',loai:'',ssId:'',truong:'',to:'',coQuan:'',ss:null};
// Cột FolderID (tên cũ) nay giữ danh sách tổ chuyên môn trường chọn khi đăng ký (JSON). Trước khi email được xác nhận: MaXacNhan = bản băm của mã, HanXacNhan = thời điểm hết hạn.
const DV_COT=['MaDonVi','ThoiGian','Loai','TenTruong','TenTo','CoQuan','HoTen','Email','SheetID','FolderID','TrangThai','NgayDuyet','HanXacNhan','MaXacNhan'];
const DV_GIU_CHO=['goc','admin','mau','test','demo','truong','to','cong-dong','thu'];
const DV_DAU_MAU='TH50-SHEET-DU-LIEU';
const DV_NGAY_TAM=30;
// Các hàm đơn vị đăng ký được gọi. Không có: đăng nhập Admin gốc, cài trigger, các hàm của Admin dự án.
const DV_API=['registerUser','activateAccount','requestAccessCode','verifyLogin','listPublicTeams','getPublicConfig','bootstrap','logout','updateProfile','setMyGeminiKey','adminApprovals','adminUsers','setUserStatus','setUserPermissions','approveRegistration','saveModule','saveTeam','listTeams','listTeamMembers','addTeamMember','removeTeamMember','chuyenTo','leaderSetMemberPermissions','saveOrgSettings','setGeminiApiKey','getAiStatus','createMeeting','respondAttendance','setAttendance','deleteMeeting','assignMeetingSecretary','saveMeetingMinutes','exportMeetingMinutesPdf','exportMeetingMinutesDocx','deleteMinutes','saveNotebook','exportNotebookPdf','exportNotebookDocx','deleteNotebook','createPersonalNotebookFromMinutes','taoLaiTep','aiUpload','aiChat','aiExport','exportAiDocPdf','deleteAiDoc','aiLesson','aiSaveHtml'];

// Thuộc tính tập lệnh theo đơn vị: đơn vị gốc dùng khóa như cũ; đơn vị đăng ký có tiền tố riêng nên phiên đăng nhập,
// khóa Gemini, thư mục tạm... của các đơn vị không lẫn vào nhau.
function P_(){
  const p=PropertiesService.getScriptProperties();if(!DV_.ma)return p;
  const pre=DV_PREFIX+'dv:'+DV_.ma+':';
  return {getProperty:k=>p.getProperty(pre+k),setProperty:(k,v)=>p.setProperty(pre+k,v),deleteProperty:k=>p.deleteProperty(pre+k),
    getProperties:()=>{const all=p.getProperties(),o={};Object.keys(all).forEach(k=>{if(k.indexOf(pre)===0)o[k.slice(pre.length)]=all[k];});return o;}};
}
function dvKey_(k){return DV_PREFIX+k;}
function dvMa_(s){return String(s||'').trim().toLowerCase();}
// Email tài khoản hệ thống lấy qua Drive (quyền đã có sẵn); không dùng Session để khỏi phải xin thêm quyền mới.
let DV_HE_THONG_='';
function dvHeThong_(){if(!DV_HE_THONG_){try{DV_HE_THONG_=String(DriveApp.getRootFolder().getOwner().getEmail()||'').toLowerCase()}catch(e){}}return DV_HE_THONG_;}
function dvIdTuLink_(s){const m=String(s||'').match(/[-\w]{25,}/);return m?m[0]:'';}
function dvLoi_(m){return {success:false,message:m};}
function dvBam_(muoi,v){let h=String(muoi)+':'+String(v);for(let i=0;i<300;i++)h=digest_(h);return h;}
function retention_(){return DV_.ma?DV_NGAY_TAM:TH50.RETENTION_DAYS;}
function dvLinkTrang_(){return DV_.ma?DV_LINK+'?truong='+DV_.ma:ScriptApp.getService().getUrl();}
function dvLinkKichHoat_(email){return dvLinkTrang_()+(DV_.ma?'&':'?')+'activate=1&email='+encodeURIComponent(email);}
function hanMucEmail_(){try{return MailApp.getRemainingDailyQuota()}catch(e){return 0}}
function canConEmail_(){if(hanMucEmail_()<1)throw new Error('Hôm nay hệ thống đã hết lượt gửi email của Google. Cô/thầy vui lòng thử lại vào ngày mai.');}

// ---------- Sổ đăng ký các đơn vị (một Sheet riêng của dự án tổng) ----------
function dvSo_(tao){
  const props=PropertiesService.getScriptProperties();let id=props.getProperty(dvKey_('SO_DANG_KY_ID'));
  if(id)return SpreadsheetApp.openById(id);
  if(!tao)return null;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    id=props.getProperty(dvKey_('SO_DANG_KY_ID'));if(id)return SpreadsheetApp.openById(id);
    const ss=SpreadsheetApp.create('Trường học 5.0 – Sổ đăng ký các đơn vị (dự án tổng)'),sh=ss.getSheets()[0];
    sh.setName('DonVi');sh.appendRow(DV_COT);sh.setFrozenRows(1);
    sh.appendRow(['goc',new Date(),'GOC',TH50_DEFAULT_ORG.school,'',TH50_DEFAULT_ORG.authority,'Trần Thị Thu Hương',dvHeThong_(),'','','Đơn vị gốc',new Date(),'','']);
    props.setProperty(dvKey_('SO_DANG_KY_ID'),ss.getId());return ss;
  }finally{lock.releaseLock();}
}
function dvDong_(){
  const so=dvSo_(false),sh=so&&so.getSheetByName('DonVi');
  return sh&&sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,DV_COT.length).getValues().map((r,i)=>{const o={_row:i+2};DV_COT.forEach((k,j)=>o[k]=r[j]);o.MaDonVi=dvMa_(o.MaDonVi);return o;}).filter(o=>o.MaDonVi):[];
}
function dvCot_(k){return DV_COT.indexOf(k)+1;}
// SpreadsheetApp.openById với Sheet không có quyền báo lỗi mà try/catch không bắt được (đã gặp ở Sổ liên lạc),
// nên luôn hỏi Drive trước: mở được không, có phải Google Sheet không, tài khoản hệ thống có quyền sửa không, ai là chủ.
function dvQuyen_(id){
  try{
    const f=DriveApp.getFileById(id);
    if(f.getMimeType()!=='application/vnd.google-apps.spreadsheet')return {quyen:'',chu:''};
    const q=f.getAccess(dvHeThong_()),o=f.getOwner();
    return {quyen:(q===DriveApp.Permission.EDIT||q===DriveApp.Permission.OWNER)?'sua':'xem',chu:o?String(o.getEmail()||'').toLowerCase():''};
  }catch(e){return {quyen:'',chu:''};}
}
function dvXoaNho_(ma){CacheService.getScriptCache().remove(dvKey_('dv:')+ma);}
function dvDat_(r){
  DV_={ma:r.MaDonVi,loai:String(r.Loai),ssId:String(r.SheetID),truong:String(r.TenTruong||''),to:String(r.TenTo||''),coQuan:String(r.CoQuan||''),ss:null};
  COLLAB_TEAMS_=null;AI_SHEETS_READY_=false;AI_PROPS_=null;
}
function dvRa_(){DV_={ma:'',loai:'',ssId:'',truong:'',to:'',coQuan:'',ss:null};COLLAB_TEAMS_=null;AI_SHEETS_READY_=false;AI_PROPS_=null;}
// Chuyển lượt gọi hiện tại sang đơn vị <ma>. Trả về false nếu đơn vị chưa kích hoạt hoặc hệ thống không còn quyền trên Sheet.
function dvVao_(ma,choPhepChuaDuyet){
  ma=dvMa_(ma);if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(ma)||ma==='goc')return false;
  const cache=CacheService.getScriptCache(),key=dvKey_('dv:')+ma;let r=null;
  const raw=choPhepChuaDuyet?null:cache.get(key);
  if(raw){try{r=JSON.parse(raw)}catch(e){}}
  if(!r){
    const x=dvDong_().find(o=>o.MaDonVi===ma);
    r=x?{MaDonVi:x.MaDonVi,Loai:x.Loai,SheetID:x.SheetID,TenTruong:x.TenTruong,TenTo:x.TenTo,CoQuan:x.CoQuan,TrangThai:x.TrangThai,ok:false}:{TrangThai:''};
    if(r.TrangThai==='Đang hoạt động'||(choPhepChuaDuyet&&r.TrangThai))r.ok=dvQuyen_(r.SheetID).quyen==='sua';
    if(!choPhepChuaDuyet)cache.put(key,JSON.stringify(r),300);
  }
  if(!r.ok||(!choPhepChuaDuyet&&r.TrangThai!=='Đang hoạt động'))return false;
  dvDat_(r);return true;
}
function dvDb_(){
  if(!DV_.ss){
    DV_.ss=SpreadsheetApp.openById(DV_.ssId);
    const p=P_();if(p.getProperty('schemaVersion')!=='27'){baseSchema_(DV_.ss);p.setProperty('schemaVersion','27');}
  }
  return DV_.ss;
}
// Thư mục tạm của đơn vị đăng ký nằm trong Drive của hệ thống: Trường học 5.0 / Tệp tạm của đơn vị đăng ký / <mã>.
function dvThuMuc_(){
  const con=(cha,ten)=>{const it=cha.getFoldersByName(ten);return it.hasNext()?it.next():cha.createFolder(ten);};
  const p=PropertiesService.getScriptProperties(),id=p.getProperty('folder:root');
  let goc;if(id)goc=DriveApp.getFolderById(id);else{const it=DriveApp.getFoldersByName(TH50.ROOT);goc=it.hasNext()?it.next():DriveApp.createFolder(TH50.ROOT);}
  return con(con(goc,(DV_PREFIX?'[THỬ] ':'')+'Tệp tạm của đơn vị đăng ký'),DV_.ma);
}
// Tệp của đơn vị đăng ký nằm trong Drive của hệ thống nên phải mở quyền xem bằng đường link thì người dùng mới mở, tải được.
function dvChiaSe_(fileId){
  if(!DV_.ma||!fileId)return;
  try{DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW)}catch(e){}
}

// ---------- Tổ chuyên môn của trường đăng ký (05/10/2026) ----------
// Trường có nhiều tổ (theo khối lớp hoặc theo môn): tạo sẵn bộ tổ mặc định, trường bỏ/đổi tên/thêm khi đăng ký và trong Cài đặt.
let DV_DS_TO_=null; // danh sách tổ trường chọn khi đăng ký, chỉ dùng lúc kích hoạt
const DV_TO_MAC_DINH=['Tổ 1','Tổ 2','Tổ 3','Tổ 4','Tổ 5','Tổ Tiếng Anh – Tin học','Tổ Bộ môn'];
function dvTruong_(){return !!DV_.ma&&DV_.loai!=='TO';}
// Đơn vị gốc và đơn vị theo tổ vẫn dùng tổ 'to-4' như cũ; trường đăng ký thì tài khoản chưa có tổ là "chưa xếp tổ".
function toMacDinh_(){return dvTruong_()?'':'to-4';}
function dvDsTo_(v){
  const chuan=x=>String(x===null||x===undefined?'':x).replace(/[<>]/g,'').replace(/\s+/g,' ').trim();
  let a=[];if(Array.isArray(v))a=v;else{try{a=JSON.parse(String(v||'[]'))}catch(e){a=[]}}
  const out=[],da={};(Array.isArray(a)?a:[]).map(chuan).forEach(t=>{const k=t.toLowerCase();if(t&&!da[k]){da[k]=1;out.push(t.slice(0,80));}});
  return out.slice(0,20);
}
// Thêm các tổ còn thiếu cho trường (chạy một lần cho mỗi trường). dsTo = danh sách trường chọn khi đăng ký.
// Trường đã đăng ký trước đây (chỉ có "Tổ chuyên môn 1" do hệ thống tạo): chỉ THÊM các tổ còn thiếu, không đổi tổ cũ, không chuyển ai.
function dvBoSungTo_(db,teams,dsTo){
  const p=P_();if(p.getProperty('boToMacDinh')==='1')return 0;
  const chuan=x=>String(x||'').replace(/\s+/g,' ').trim().toLowerCase();
  let them=[];
  if(!teams.length)them=(dsTo&&dsTo.length?dsTo:DV_TO_MAC_DINH).slice();
  else if(teams.length===1&&teams[0].id==='to-4'&&teams[0].createdBy==='du-an-tong'){
    const co=chuan(teams[0].name)==='tổ chuyên môn 1'?['tổ 1','tổ chuyên môn 1']:[chuan(teams[0].name)];
    them=DV_TO_MAC_DINH.filter(t=>co.indexOf(chuan(t))<0);
  }
  them=them.filter(t=>!teams.some(x=>chuan(x.name)===chuan(t)));
  them.forEach(t=>append_(db,'Teams',{id:'to-'+Utilities.getUuid().slice(0,8),name:t,schoolYear:'2026-2027',active:true,createdAt:now_(),createdBy:'du-an-tong'}));
  p.setProperty('boToMacDinh','1');COLLAB_TEAMS_=null;
  return them.length;
}
// Admin chuyển giáo viên sang tổ khác. Sổ họp, biên bản, lịch họp cũ vẫn thuộc tổ cũ.
function chuyenTo(token,email,teamId){
  const actor=requireRole_(token,['ADMIN']),db=db_();ensureCollabSheets_(db);email=cleanEmail_(email);teamId=cleanText_(teamId,80);
  if(!read_(db,'Teams').some(t=>t.id===teamId))throw new Error('Không tìm thấy tổ chuyên môn.');
  const u=read_(db,'Users').find(x=>x.email===email);if(!u||u.role==='ADMIN')throw new Error('Không tìm thấy giáo viên.');
  const ms=read_(db,'Memberships').filter(x=>x.userEmail===email&&x.status!=='REMOVED'),cu=ms.find(x=>x.teamId!==teamId)||ms[0]||{};
  updateWhere_(db,'Memberships',x=>x.userEmail===email&&x.teamId!==teamId&&x.status!=='REMOVED',x=>Object.assign(x,{status:'REMOVED'}));
  const st=u.status==='INVITED'?'INVITED':u.status==='DISABLED'?'DISABLED':'ACTIVE',den=read_(db,'Memberships').find(x=>x.userEmail===email&&x.teamId===teamId);
  if(den)updateWhere_(db,'Memberships',x=>x.id===den.id,x=>Object.assign(x,{status:st,role:u.role}));
  else append_(db,'Memberships',{id:Utilities.getUuid(),teamId:teamId,userEmail:email,role:u.role,status:st,className:cu.className||u.className||'',phone:cu.phone||u.phone||'',features:cu.features||u.features||'notebooks,meetings',createdAt:now_(),createdBy:actor.email});
  updateWhere_(db,'Users',x=>x.email===email,x=>Object.assign(x,{teamId:teamId}));
  audit_(db,actor,'MOVE_TEAM',email+':'+teamId);return {moved:true,teamId:teamId};
}

// Mọi lệnh từ trang của đơn vị đăng ký đi qua đây.
function goi(ma,tenHam,thamSo){
  tenHam=String(tenHam||'');
  if(DV_API.indexOf(tenHam)<0)throw new Error('Chức năng này chưa mở cho đơn vị đăng ký.');
  if(!dvVao_(ma))throw new Error('Đơn vị này chưa được kích hoạt hoặc đã tạm ngừng. Thầy/cô kiểm tra lại việc chia sẻ Google Sheet với hệ thống.');
  if(DV_.loai==='TO'&&tenHam==='saveTeam')throw new Error('Đơn vị đăng ký theo tổ chuyên môn chỉ có một tổ.');
  return globalThis[tenHam].apply(null,Array.isArray(thamSo)?thamSo:[]);
}

// Dọn các phiên đăng nhập đã hết hạn để Thuộc tính tập lệnh không đầy dần.
function purgeSessions_(){
  const p=P_(),all=p.getProperties(),now=Date.now();
  Object.keys(all).filter(k=>k.indexOf('session:')===0).forEach(k=>{try{if(JSON.parse(all[k]).expires<now)p.deleteProperty(k)}catch(e){p.deleteProperty(k)}});
}

// Sổ họp, biên bản của đơn vị đăng ký: tệp tạm đã hết hạn thì tạo lại từ nội dung đang lưu trong Sheet của đơn vị.
function taoLaiTep(token,loai,id){
  const user=requireUser_(token),db=db_(),bang=loai==='minutes'?'Minutes':'Notebooks';
  const item=read_(db,bang).find(n=>n.id===id&&(loai==='minutes'?canSeeMinutes_(user,n):liveDoc_(n)&&(user.role==='ADMIN'||n.ownerEmail===user.email)));
  if(!item)throw new Error('Không tìm thấy văn bản.');
  if(item.docId){try{if(!DriveApp.getFileById(String(item.docId)).isTrashed())return {docUrl:item.docUrl};}catch(e){}}
  const doc=loai==='minutes'?createMeetingMinutesDoc_(item):createNotebookDoc_(item);
  updateWhere_(db,bang,r=>r.id===id,r=>Object.assign(r,{docId:doc.getId(),docUrl:doc.getUrl(),pdfUrl:'',docxUrl:'',expiresAt:expiry_()}));
  audit_(db,user,'RECREATE_DOC',id);return {docUrl:doc.getUrl()};
}

// ---------- Trang dự án tổng: thông tin, đăng ký ----------
// Sheet mẫu công khai (ai có link đều xem được) để người đăng ký bấm "Tạo bản sao" về Drive của mình.
function dvTaoSheetMau_(){
  const p=PropertiesService.getScriptProperties(),cu=p.getProperty(dvKey_('SHEET_MAU_ID'));
  if(cu){try{if(!DriveApp.getFileById(cu).isTrashed())return cu;}catch(e){}}
  const ss=SpreadsheetApp.create((DV_PREFIX?'[THỬ] ':'')+'Trường học 5.0 – Sheet dữ liệu của đơn vị (tạo bản sao để dùng)'),sh=ss.getSheets()[0];
  sh.setName('HuongDan');sh.setColumnWidth(1,720);
  sh.getRange(1,1,7,1).setValues([[DV_DAU_MAU],['TRƯỜNG HỌC 5.0 – SHEET DỮ LIỆU CỦA ĐƠN VỊ'],['Đây là nơi lưu toàn bộ dữ liệu của trường/tổ chuyên môn: tài khoản giáo viên, tổ, lịch họp, điểm danh, sổ họp, biên bản.'],['Sheet này nằm trong Google Drive của thầy/cô và thuộc về thầy/cô.'],['Bước tiếp theo: bấm nút Chia sẻ ở góc trên bên phải, nhập địa chỉ tài khoản hệ thống ghi trên trang đăng ký, chọn quyền Người chỉnh sửa, rồi dán link của Sheet này vào trang đăng ký.'],['Không cần nhập gì vào đây. Hệ thống tự tạo các trang dữ liệu khi đơn vị được duyệt.'],['Muốn ngừng sử dụng: bỏ chia sẻ Sheet này với tài khoản hệ thống. Dữ liệu vẫn nằm nguyên trong Drive của thầy/cô.']]);
  sh.getRange('A2').setFontWeight('bold').setFontSize(13);sh.getRange('A1').setFontColor('#999999').setFontSize(8);sh.getRange('A1:A7').setWrap(true);
  DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  p.setProperty(dvKey_('SHEET_MAU_ID'),ss.getId());return ss.getId();
}
function getThongTinDangKy(){
  let so=1;try{so=Math.max(1,dvDong_().filter(r=>r.TrangThai==='Đang hoạt động'||r.TrangThai==='Đơn vị gốc').length)}catch(e){}
  const mau=PropertiesService.getScriptProperties().getProperty(dvKey_('SHEET_MAU_ID'))||'';
  return {emailHeThong:dvHeThong_(),linkGoc:DV_LINK,soDonVi:so,linkMau:mau?'https://docs.google.com/spreadsheets/d/'+mau+'/copy':''};
}
function dvKiemTraDauVao_(d){
  const g=(k,n)=>String(d[k]===null||d[k]===undefined?'':d[k]).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n);
  const o={loai:d.loai==='TO'?'TO':'TRUONG',truong:g('tenTruong',121).toUpperCase(),to:g('tenTo',81),coQuan:g('coQuan',151).toUpperCase(),hoTen:g('hoTen',61),email:g('email',100).toLowerCase(),ma:dvMa_(d.maDonVi),sheetId:dvIdTuLink_(d.linkSheet)};
  if(o.truong.length<5||o.truong.length>120)return 'Vui lòng nhập tên trường (5–120 ký tự).';
  if(o.loai==='TO'&&(o.to.length<2||o.to.length>80))return 'Vui lòng nhập tên tổ chuyên môn (2–80 ký tự).';
  o.dsTo=o.loai==='TO'?[]:(d.dsTo===undefined?DV_TO_MAC_DINH.slice():dvDsTo_(d.dsTo));
  if(o.loai!=='TO'&&!o.dsTo.length)return 'Vui lòng chọn ít nhất một tổ chuyên môn của trường.';
  if(o.dsTo.some(t=>t.length<2))return 'Tên mỗi tổ chuyên môn cần từ 2 đến 80 ký tự.';
  if(o.coQuan.length>150)return 'Tên cơ quan chủ quản tối đa 150 ký tự.';
  if(o.hoTen.length<2||o.hoTen.length>60)return 'Vui lòng nhập họ tên thầy/cô (2–60 ký tự).';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email))return 'Vui lòng nhập email hợp lệ.';
  if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(o.ma)||DV_GIU_CHO.indexOf(o.ma)>=0)return 'Mã đơn vị gồm 3–40 ký tự: chữ thường không dấu, số, dấu gạch ngang (ví dụ: th-truongdinh hoặc to4-truongdinh).';
  if(!o.sheetId)return 'Vui lòng dán đường link Google Sheet của thầy/cô.';
  return o;
}
// Bước 1: kiểm tra Sheet, ghi đăng ký ở trạng thái "Chờ xác nhận email" và gửi mã về email của chính người đăng ký.
function dangKyDonVi(data){
  data=data||{};
  if(data.dongY!==true)return dvLoi_('Thầy/cô cần đọc và đồng ý điều khoản sử dụng trước khi đăng ký.');
  const o=dvKiemTraDauVao_(data);if(typeof o==='string')return dvLoi_(o);
  const cache=CacheService.getScriptCache(),gh=dvKey_('dk:')+digest_(o.email);
  if(cache.get(gh))return dvLoi_('Thầy/cô vừa gửi đăng ký. Vui lòng chờ 60 giây rồi gửi lại.');
  const heThong=dvHeThong_(),q=dvQuyen_(o.sheetId);
  if(!q.quyen)return dvLoi_('Hệ thống chưa mở được Google Sheet. Thầy/cô kiểm tra lại: đúng link của bản sao vừa tạo và đã chia sẻ cho '+heThong+'.');
  if(q.quyen!=='sua')return dvLoi_('Sheet mới được chia sẻ ở quyền xem. Thầy/cô đổi quyền của '+heThong+' thành “Người chỉnh sửa”.');
  if(q.chu&&q.chu===heThong)return dvLoi_('Sheet này đang thuộc tài khoản hệ thống. Thầy/cô cần bấm “Tạo bản sao Sheet mẫu” để có Sheet trong Drive của chính mình.');
  let rootDb='';try{rootDb=PropertiesService.getScriptProperties().getProperty('dbId')||''}catch(e){}
  if(o.sheetId===rootDb)return dvLoi_('Sheet này thuộc đơn vị gốc, không dùng để đăng ký được.');
  let dau='';try{const hd=SpreadsheetApp.openById(o.sheetId).getSheetByName('HuongDan');dau=hd?String(hd.getRange(1,1).getValue()).trim():''}catch(e){return dvLoi_('Hệ thống chưa mở được Google Sheet. Thầy/cô kiểm tra lại bước chia sẻ.');}
  if(dau!==DV_DAU_MAU)return dvLoi_('Sheet chưa đúng mẫu. Thầy/cô bấm “Tạo bản sao Sheet mẫu” và dùng đúng bản sao đó (không dùng Sheet đang có dữ liệu khác).');
  if(hanMucEmail_()<1)return dvLoi_('Hôm nay hệ thống đã hết lượt gửi email của Google. Thầy/cô vui lòng đăng ký lại vào ngày mai.');
  const code=('000000'+Math.floor(Math.random()*1000000)).slice(-6),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=dvSo_(true).getSheetByName('DonVi'),ds=dvDong_().filter(r=>r.TrangThai!=='Đã từ chối');
    const cu=ds.find(r=>r.MaDonVi===o.ma),trungSheet=ds.find(r=>String(r.SheetID)===o.sheetId&&r.MaDonVi!==o.ma);
    if(trungSheet)return dvLoi_('Google Sheet này đã được đăng ký cho một đơn vị khác.');
    if(cu&&!(cu.TrangThai==='Chờ xác nhận email'&&String(cu.Email).toLowerCase()===o.email))return dvLoi_('Mã đơn vị này đã có người dùng. Thầy/cô chọn mã khác.');
    const dong=[o.ma,new Date(),o.loai,o.truong,o.to,o.coQuan,o.hoTen,o.email,o.sheetId,o.dsTo.length?JSON.stringify(o.dsTo):'','Chờ xác nhận email','',Date.now()+30*60000,dvBam_(o.ma,code)];
    if(cu)sh.getRange(cu._row,1,1,DV_COT.length).setValues([dong]);else sh.appendRow(dong);
    dvXoaNho_(o.ma);
  }finally{lock.releaseLock();}
  MailApp.sendEmail({to:o.email,subject:'Mã xác nhận đăng ký Trường học 5.0',htmlBody:'<p>Kính gửi thầy/cô '+escapeHtml_(o.hoTen)+',</p><p>Mã xác nhận đăng ký đơn vị “'+escapeHtml_((o.loai==='TO'?o.to+' – ':'')+o.truong)+'” trên Trường học 5.0:</p><h1 style="letter-spacing:5px">'+code+'</h1><p>Mã có hiệu lực trong 30 phút. Nếu thầy/cô không đăng ký, vui lòng bỏ qua thư này.</p>',name:'Trường học 5.0'});
  cache.put(gh,'1',60);
  return {success:true,canXacNhan:true,ma:o.ma,message:'Hệ thống đã gửi mã xác nhận gồm 6 chữ số đến '+o.email+'. Thầy/cô nhập mã vào ô bên dưới để hoàn tất đăng ký.'};
}
// Bước 2: nhập đúng mã thì đăng ký chuyển sang "Chờ duyệt". Admin dự án duyệt xong đơn vị mới dùng được.
function xacNhanDangKy(ma,code){
  ma=dvMa_(ma);code=String(code||'').replace(/\D/g,'');
  const cache=CacheService.getScriptCache(),dem=dvKey_('xn:')+ma,sai=Number(cache.get(dem)||0);
  if(sai>=8)return dvLoi_('Nhập sai quá nhiều lần. Thầy/cô vui lòng gửi lại đăng ký để nhận mã mới sau 10 phút.');
  const r=dvDong_().find(x=>x.MaDonVi===ma&&x.TrangThai==='Chờ xác nhận email');
  if(!r)return dvLoi_('Không tìm thấy đăng ký đang chờ xác nhận với mã đơn vị này.');
  if(Number(r.HanXacNhan)<Date.now())return dvLoi_('Mã xác nhận đã hết hạn. Thầy/cô bấm “Gửi đăng ký” lại để nhận mã mới.');
  if(code.length!==6||dvBam_(ma,code)!==String(r.MaXacNhan)){cache.put(dem,String(sai+1),600);return dvLoi_('Mã xác nhận không đúng.');}
  const sh=dvSo_(true).getSheetByName('DonVi');
  sh.getRange(r._row,dvCot_('TrangThai')).setValue('Chờ duyệt');sh.getRange(r._row,dvCot_('HanXacNhan'),1,2).setValues([['','']]);
  dvXoaNho_(ma);
  return {success:true,link:DV_LINK+'?truong='+ma,message:'Đã xác nhận email và ghi nhận đăng ký. Khi Admin dự án duyệt, thầy/cô sẽ nhận email kèm link của đơn vị và đăng nhập bằng mã gửi về chính email này.'};
}

// ---------- Admin dự án tổng (tách khỏi Admin của mọi đơn vị, kể cả đơn vị gốc) ----------
// Mật khẩu chỉ đặt được trong Apps Script: Cài đặt dự án > Thuộc tính tập lệnh > thêm MAT_KHAU_QUAN_TRI (8–60 ký tự).
// Lần đăng nhập đầu, hệ thống lưu bản băm (QT_BAM/QT_MUOI) và xóa bản rõ. Đổi mật khẩu: thêm lại MAT_KHAU_QUAN_TRI.
function quanTriNhanMatKhauMoi_(){
  const p=PropertiesService.getScriptProperties(),ro=p.getProperty(dvKey_('MAT_KHAU_QUAN_TRI'));
  if(ro===null||ro===undefined)return '';
  if(String(ro).length<8||String(ro).length>60)return 'Mật khẩu Admin dự án đặt trong Apps Script phải từ 8 đến 60 ký tự.';
  const muoi=Utilities.getUuid();
  p.setProperty(dvKey_('QT_MUOI'),muoi);p.setProperty(dvKey_('QT_BAM'),dvBam_(muoi,String(ro)));p.deleteProperty(dvKey_('MAT_KHAU_QUAN_TRI'));
  return '';
}
function dangNhapQuanTri(matKhau){
  const cache=CacheService.getScriptCache(),dem=dvKey_('qtsai'),lan=Number(cache.get(dem)||0);
  if(lan>=10)return dvLoi_('Nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.');
  const loi=quanTriNhanMatKhauMoi_();if(loi)return dvLoi_(loi);
  const p=PropertiesService.getScriptProperties(),bam=p.getProperty(dvKey_('QT_BAM')),muoi=p.getProperty(dvKey_('QT_MUOI'));
  if(!bam||!muoi)return dvLoi_('Chưa đặt mật khẩu Admin của dự án. Mật khẩu được đặt trong Apps Script, mục Thuộc tính tập lệnh (MAT_KHAU_QUAN_TRI).');
  if(dvBam_(muoi,String(matKhau||''))!==bam){cache.put(dem,String(lan+1),600);return dvLoi_('Mật khẩu không đúng.');}
  const token=Utilities.getUuid()+Utilities.getUuid();cache.put(dvKey_('qt:')+digest_(token),'1',21600);
  return {success:true,token:token};
}
function requireQuanTri_(token){if(!token||CacheService.getScriptCache().get(dvKey_('qt:')+digest_(token))!=='1')throw new Error('Phiên Admin dự án đã hết hạn. Vui lòng đăng nhập lại.');}
function getDonViDangKy(quanTriToken){
  requireQuanTri_(quanTriToken);dvSo_(true);
  const ds=dvDong_().map(r=>{const goc=r.TrangThai==='Đơn vị gốc';return {ma:r.MaDonVi,loai:String(r.Loai),thoiGian:r.ThoiGian instanceof Date?Utilities.formatDate(r.ThoiGian,TH50.TZ,'dd/MM/yyyy HH:mm'):'',truong:String(r.TenTruong||''),to:String(r.TenTo||''),hoTen:String(r.HoTen||''),email:String(r.Email||''),trangThai:String(r.TrangThai||''),link:goc?DV_LINK:DV_LINK+'?truong='+r.MaDonVi};}).reverse();
  return {donVi:ds,emailConLai:hanMucEmail_()};
}
// Kích hoạt lần đầu: tạo cấu trúc dữ liệu trong Sheet của đơn vị và tài khoản quản trị (đăng nhập bằng mã gửi về email).
function dvKhoiTao_(r){
  if(!dvVao_(r.MaDonVi,true))throw new Error('Hệ thống không còn quyền chỉnh sửa trên Google Sheet của đơn vị này.');
  try{
    const db=db_();DV_DS_TO_=String(r.Loai)!=='TO'?dvDsTo_(r.FolderID):null;COLLAB_TEAMS_=null;ensureCollabSheets_(db);DV_DS_TO_=null;const email=cleanEmail_(r.Email);
    if(!read_(db,'Users').some(u=>u.email===email)){
      append_(db,'Users',{id:Utilities.getUuid(),email:email,name:String(r.HoTen),phone:'',role:'ADMIN',status:'APPROVED',createdAt:now_(),approvedAt:now_(),approvedBy:'du-an-tong',personalFolderId:'',activationHash:'',activationExpiry:'',features:'all',teamId:String(r.Loai)==='TO'?'to-4':''});
      // Đăng ký theo tổ: người đăng ký là tổ trưởng của tổ đó nên có tên trong danh sách thành viên.
      if(String(r.Loai)==='TO')append_(db,'Memberships',{id:Utilities.getUuid(),teamId:'to-4',userEmail:email,role:'LEADER',status:'ACTIVE',className:'',phone:'',features:'all',createdAt:now_(),createdBy:'du-an-tong'});
    }
  }finally{dvRa_();}
}
function capNhatDonVi(quanTriToken,ma,trangThai){
  requireQuanTri_(quanTriToken);ma=dvMa_(ma);
  if(['Đang hoạt động','Tạm ngừng','Đã từ chối'].indexOf(trangThai)<0)return dvLoi_('Trạng thái không hợp lệ.');
  const sh=dvSo_(true).getSheetByName('DonVi'),r=dvDong_().find(x=>x.MaDonVi===ma);
  if(!r)return dvLoi_('Không tìm thấy đơn vị.');
  if(r.TrangThai==='Đơn vị gốc')return dvLoi_('Đơn vị gốc luôn hoạt động ở link chính.');
  if(r.TrangThai==='Chờ xác nhận email'&&trangThai==='Đang hoạt động')return dvLoi_('Người đăng ký chưa xác nhận email nên chưa duyệt được.');
  const lanDau=trangThai==='Đang hoạt động'&&!r.NgayDuyet;let daGuiEmail=false;
  if(trangThai==='Đang hoạt động'){try{dvKhoiTao_(r)}catch(e){return dvLoi_(e.message);}}
  sh.getRange(r._row,dvCot_('TrangThai')).setValue(trangThai);
  if(lanDau)sh.getRange(r._row,dvCot_('NgayDuyet')).setValue(new Date());
  dvXoaNho_(ma);
  if(lanDau){try{MailApp.sendEmail({to:String(r.Email),subject:'Trường học 5.0: đơn vị của thầy/cô đã được kích hoạt',body:'Kính gửi thầy/cô '+r.HoTen+',\n\nĐơn vị “'+(String(r.Loai)==='TO'?r.TenTo+' – ':'')+r.TenTruong+'” đã được kích hoạt trên Trường học 5.0.\n\nLink của đơn vị: '+DV_LINK+'?truong='+ma+'\n\nThầy/cô mở link, chọn thẻ Đăng nhập, nhập email này rồi bấm “Gửi mã đăng nhập”; mã sẽ được gửi về chính email này. Sau đó thêm giáo viên ở mục Thành viên, hệ thống sẽ gửi mã kích hoạt đến email của từng người.\n\nDữ liệu của đơn vị nằm trong Google Sheet của thầy/cô. Muốn ngừng sử dụng, thầy/cô chỉ cần bỏ chia sẻ Sheet đó với tài khoản hệ thống.',name:'Trường học 5.0'});daGuiEmail=true}catch(e){}}
  return {success:true,daGuiEmail:daGuiEmail};
}
// Số liệu sử dụng của từng đơn vị (chỉ con số) cho Admin dự án.
function getSoLieuCongDong(quanTriToken){
  requireQuanTri_(quanTriToken);
  const dem=(ss,ten)=>{const sh=ss.getSheetByName(ten);return sh?Math.max(0,sh.getLastRow()-1):0;};
  return dvDong_().filter(r=>r.TrangThai==='Đang hoạt động'||r.TrangThai==='Đơn vị gốc').slice(0,40).map(r=>{
    const o={ma:r.MaDonVi,ten:(String(r.Loai)==='TO'?r.TenTo+' – ':'')+r.TenTruong,ok:false,nguoiDung:0,to:0,lichHop:0,soHop:0,bienBan:0,vanBanAI:0};
    try{
      let ss;
      if(r.TrangThai==='Đơn vị gốc'){dvRa_();ss=db_();}
      else{if(dvQuyen_(String(r.SheetID)).quyen!=='sua')return o;ss=SpreadsheetApp.openById(String(r.SheetID));}
      o.nguoiDung=dem(ss,'Users');o.to=dem(ss,'Teams');o.lichHop=dem(ss,'Meetings');o.soHop=dem(ss,'Notebooks');o.bienBan=dem(ss,'Minutes');o.vanBanAI=dem(ss,'AiDocs');o.ok=true;
    }catch(e){}
    return o;
  });
}

// ---------- Trang trả về theo link ----------
function dvTrang_(e){
  const p=(e&&e.parameter)||{};
  if(p.trang==='cong-dong')return HtmlService.createHtmlOutputFromFile('CongDong').setTitle('Trường học 5.0 – Dự án tổng').addMetaTag('viewport','width=device-width, initial-scale=1');
  if(!p.truong)return null;
  const ma=dvMa_(p.truong);
  if(!dvVao_(ma))return HtmlService.createHtmlOutput('<div style="font-family:Segoe UI,Arial,sans-serif;max-width:540px;margin:70px auto;padding:24px;text-align:center;color:#243c35"><div style="font-size:44px">🏫</div><h2>Đơn vị này chưa được kích hoạt</h2><p>Link có mã “'+escapeHtml_(ma)+'” chưa hoạt động: đơn vị đang chờ duyệt, đã tạm ngừng, hoặc Google Sheet không còn chia sẻ cho hệ thống.</p><p><a target="_top" href="'+DV_LINK+'?trang=cong-dong">Xem trang dự án Trường học 5.0</a></p></div>').setTitle('Trường học 5.0').addMetaTag('viewport','width=device-width, initial-scale=1');
  const ten=(DV_.loai==='TO'?DV_.to+' – ':'')+DV_.truong;
  const html=HtmlService.createHtmlOutputFromFile('Index').getContent().replace('<head>','<head><script>window.TH50_DV='+JSON.stringify(DV_.ma)+';window.TH50_DV_LOAI='+JSON.stringify(DV_.loai)+';window.TH50_DV_TEN='+JSON.stringify(ten).replace(/</g,'\\u003c')+';<\/script>');
  return HtmlService.createHtmlOutput(html).setTitle('Trường học 5.0 · '+ten).addMetaTag('viewport','width=device-width, initial-scale=1');
}
