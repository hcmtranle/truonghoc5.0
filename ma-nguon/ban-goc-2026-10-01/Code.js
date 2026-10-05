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
  TOKEN_HOURS: 8,
  CODE_MINUTES: 10,
  RETENTION_DAYS: 365
});

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Trường học 5.0 · Tổ chuyên môn 4')
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
 const db=db_();ensureCollabSheets_(db);const requestedTeamId=cleanText_(input.teamId,80)||'to-4';let existing=read_(db,'Users').find(r=>r.email===email);if(existing&&existing.role==='ADMIN'){updateWhere_(db,'Users',r=>r.id===existing.id,r=>{r.email=ADMIN_ACCOUNT;return r;});existing=null;}
 if(existing){if(existing.status==='APPROVED')return {status:'APPROVED',message:'Tài khoản đã được duyệt. Cô/thầy có thể đăng nhập.'};if(existing.status==='DISABLED')return {status:'DISABLED',message:'Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.'};if(String(existing.status).toUpperCase()==='PENDING')PropertiesService.getScriptProperties().setProperty(pendingKey_(email),JSON.stringify(existing));return {status:existing.status,message:'Yêu cầu đã được gửi và đang chờ quản trị viên duyệt.'};}
 const item={id:Utilities.getUuid(),email:email,name:name,phone:phone,role:'TEACHER',requestedRole:requestedRole,status:'PENDING',createdAt:now_(),approvedAt:'',approvedBy:'',personalFolderId:'',activationHash:'',activationExpiry:'',features:'notebooks,minutes,meetings',teamId:requestedTeamId};
 PropertiesService.getScriptProperties().setProperty(pendingKey_(email),JSON.stringify(item));append_(db,'Users',item);SpreadsheetApp.flush();
 try{MailApp.sendEmail({to:email,subject:'Đã nhận đăng ký — Trường học 5.0',htmlBody:'<p>Xin chào '+escapeHtml_(name)+',</p><p>Hệ thống đã nhận đăng ký của cô/thầy. Hồ sơ đang chờ quản trị viên duyệt.</p><p>Sau khi được duyệt, hệ thống sẽ gửi email thứ hai kèm mã kích hoạt tài khoản.</p>',name:'Trường học 5.0'});}catch(e){}
 return {status:'PENDING',message:'Đã gửi đăng ký đến quản trị viên. Hệ thống đã gửi email xác nhận tiếp nhận nếu hộp thư cho phép.'};
}
function adminApprovals(token){requireRole_(token,['ADMIN']);const db=db_(),byEmail={};read_(db,'Users').filter(u=>String(u.status||'').trim().toUpperCase()==='PENDING').forEach(u=>byEmail[u.email]=u);const p=PropertiesService.getScriptProperties(),all=p.getProperties();Object.keys(all).filter(k=>k.indexOf('pendingReg:')===0).forEach(k=>{try{const u=JSON.parse(all[k]);if(u&&u.email)byEmail[u.email]=Object.assign({},u,byEmail[u.email]||{})}catch(e){}});return {items:Object.keys(byEmail).map(k=>byEmail[k])};}
function adminUsers(token){requireRole_(token,['ADMIN']);return {items:read_(db_(),'Users').filter(u=>u.role!=='ADMIN').map(publicUser_)}}
function setUserStatus(token,email,status){
  const admin=requireRole_(token,['ADMIN']),db=db_();email=cleanEmail_(email);status=status==='DISABLED'?'DISABLED':'APPROVED';
  const u=updateWhere_(db,'Users',r=>r.email===email&&r.role!=='ADMIN',r=>Object.assign(r,{status:status,statusChangedAt:now_(),statusChangedBy:admin.email}));
  if(!u)throw new Error('Không tìm thấy tài khoản người dùng.');
  if(status==='DISABLED'){const p=PropertiesService.getScriptProperties(),all=p.getProperties();Object.keys(all).filter(k=>k.indexOf('session:')===0).forEach(k=>{try{if(JSON.parse(all[k]).email===email)p.deleteProperty(k)}catch(e){}})}
  audit_(db,admin,status==='DISABLED'?'DISABLE_USER':'RESTORE_USER',email);return publicUser_(u);
}
function requestAccessCode(email){
  email=cleanEmail_(email);if(!email)throw new Error('Vui lòng nhập email.');const db=db_(),user=read_(db,'Users').find(r=>r.email===email);
  if(!user||user.status!=='APPROVED')throw new Error(user&&user.status==='DISABLED'?'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.':'Tài khoản chưa được kích hoạt hoặc chưa được duyệt.');
  const cache=CacheService.getScriptCache(),key='login:'+digest_(email);if(cache.get(key))throw new Error('Cô/thầy vừa nhận mã. Vui lòng chờ 60 giây trước khi yêu cầu lại.');
  const raw=('000000'+Math.floor(Math.random()*1000000)).slice(-6);append_(db,'LoginCodes',{id:Utilities.getUuid(),email:email,codeHash:digest_(raw),expiresAt:Date.now()+TH50.CODE_MINUTES*60000,used:false,createdAt:now_()});cache.put(key,'1',60);
  MailApp.sendEmail({to:email,subject:'Mã đăng nhập Trường học 5.0',htmlBody:'<p>Mã đăng nhập của cô/thầy:</p><h1 style="letter-spacing:5px">'+raw+'</h1><p>Mã có hiệu lực trong '+TH50.CODE_MINUTES+' phút.</p>',name:'Trường học 5.0'});return {sent:true,message:'Mã đăng nhập đã được gửi vào email.'};
}
function setUserPermissions(token,email,features){const admin=requireRole_(token,['ADMIN']),db=db_();email=cleanEmail_(email);features=Array.isArray(features)?features.filter(x=>['meetings','notebooks','minutes','members','research','analysis','textAssistant','lessons','awards','personal'].indexOf(x)>=0).join(','):'';const u=updateWhere_(db,'Users',r=>r.email===email,r=>{r.features=features;return r;});if(!u)throw new Error('Không tìm thấy tài khoản.');audit_(db,admin,'SET_PERMISSIONS',email+':'+features);return publicUser_(u);}
function approveRegistration(token,email,role){
  const admin=requireRole_(token,['ADMIN']),db=db_();email=cleanEmail_(email);const pendingRaw=PropertiesService.getScriptProperties().getProperty(pendingKey_(email));if(!read_(db,'Users').some(r=>r.email===email)&&pendingRaw)append_(db,'Users',JSON.parse(pendingRaw));
  role=['LEADER','TEACHER'].indexOf(role)>=0?role:'TEACHER';const code=('000000'+Math.floor(Math.random()*1000000)).slice(-6);
  const u=updateWhere_(db,'Users',r=>r.email===email,r=>Object.assign(r,{role:role,status:'INVITED',approvedAt:now_(),approvedBy:admin.email,activationHash:digest_(code),activationExpiry:Date.now()+7*86400000}));
  MailApp.sendEmail({to:email,subject:'Tài khoản Trường học 5.0 đã được duyệt',htmlBody:'<p>Xin chào '+escapeHtml_(u.name)+',</p><p>Tài khoản của cô/thầy đã được duyệt với vai trò <b>'+escapeHtml_(role==='LEADER'?'Tổ trưởng':'Giáo viên')+'</b>.</p><p>Mã kích hoạt: <b style="font-size:22px;letter-spacing:4px">'+code+'</b></p><p>Mở trang kích hoạt tài khoản: <a href="'+ScriptApp.getService().getUrl()+'?activate=1&email='+encodeURIComponent(email)+'">Kích hoạt tài khoản</a></p>',name:'Trường học 5.0'});
  ensureCollabSheets_(db);const oldMember=read_(db,'Memberships').find(m=>m.teamId===(u.teamId||'to-4')&&m.userEmail===email);if(!oldMember)append_(db,'Memberships',{id:Utilities.getUuid(),teamId:u.teamId||'to-4',userEmail:email,role:role,status:'INVITED',className:'',phone:u.phone||'',features:u.features||'notebooks,meetings',createdAt:now_(),createdBy:admin.email});PropertiesService.getScriptProperties().deleteProperty(pendingKey_(email));return true;
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

function bootstrap(token) {
  const user = requireUser_(token), db = db_();
  const teams=ensureCollabSheets_(db), teamId=activeTeamId_(user,db);
  return {
    user: publicUser_(user),
    modules: read_(db, 'Modules').filter(m => user.role === 'ADMIN' || asBool_(m.visible)).sort((a,b) => String(a.order).localeCompare(String(b.order))),
    notebooks: read_(db, 'Notebooks').filter(n => n.status !== 'EXPIRED' && (user.role === 'ADMIN' || n.ownerEmail === user.email)).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    minutes: read_(db, 'Minutes').filter(n => n.status !== 'EXPIRED' && (user.role === 'ADMIN' || user.role === 'LEADER' || n.ownerEmail === user.email)).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    approvals: user.role === 'ADMIN' ? read_(db, 'Users').filter(u => u.status === 'PENDING') : [],
    systemLinks: user.role === 'ADMIN' ? systemLinks_(db) : null,
    teams: teams, activeTeamId: teamId, teamMembers: listTeamMembers(token,teamId).items, meetings: read_(db,'Meetings').filter(m=>user.role==='ADMIN'||m.teamId===teamId), aiStatus:getAiStatus(token)
  };
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
 const item={id:Utilities.getUuid(),title:cleanText_(input.title,180),meetingTime:cleanText_(input.meetingTime,80)||Utilities.formatDate(new Date(),TH50.TZ,'dd/MM/yyyy HH:mm'),location:cleanText_(input.location,180),chair:cleanText_(input.chair,120),secretary:cleanText_(input.secretary,120),principalRepresentative:cleanText_(input.principalRepresentative,120),attendees:cleanText_(input.attendees,1500),agenda:cleanText_(input.agenda,4000),researchTopic:cleanText_(input.researchTopic,1000),evidence:cleanText_(input.evidence,6000),discussion:cleanText_(input.discussion,12000),conclusion:cleanText_(input.conclusion,6000),assignments:cleanText_(input.assignments,6000),endHour:cleanText_(input.endHour,2),endMinute:cleanText_(input.endMinute,2),ownerEmail:user.email,ownerName:user.name,createdAt:now_(),expiresAt:expiry_(),status:'ACTIVE',docId:'',docUrl:'',pdfUrl:'',docxUrl:'',secretarySignatureUrl:'',principalSignatureUrl:'',chairSignatureUrl:'',attendeesSignatureUrl:''};
 if(!item.title||!item.chair||!item.secretary||!item.agenda||!item.discussion||!item.conclusion)throw new Error('Vui lòng điền đủ tên biên bản, chủ trì, thư ký, nội dung, ý kiến thảo luận và kết luận.');
 [['secretarySignatureData','secretarySignatureUrl'],['principalSignatureData','principalSignatureUrl'],['chairSignatureData','chairSignatureUrl'],['attendeesSignatureData','attendeesSignatureUrl']].forEach(x=>{if(input[x[0]])item[x[1]]=saveSignature_(user,input[x[0]])});
 const doc=createMeetingMinutesDoc_(item);item.docId=doc.getId();item.docUrl=doc.getUrl();append_(db,'Minutes',item);SpreadsheetApp.flush();audit_(db,user,'CREATE_MINUTES',item.id);return item;
}
function signatureBlob_(url){const id=fileIdFromUrl_(url);return id?DriveApp.getFileById(id).getBlob():null;}
function addSignature_(cell,url){if(!url)return;const blob=signatureBlob_(url);if(!blob)return;const p=cell.appendParagraph('');p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);p.appendInlineImage(blob).setWidth(110).setHeight(55);}
function createMeetingMinutesDoc_(item){
 const doc=DocumentApp.create(safeFile_(item.title)),body=doc.getBody();
 const head=body.appendTable([['']]);head.setBorderWidth(0);const cell=head.getCell(0,0);cell.clear();
 cell.appendParagraph('ỦY BAN NHÂN DÂN PHƯỜNG ĐÔNG HƯNG THUẬN').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
 cell.appendParagraph('TRƯỜNG TIỂU HỌC TRƯƠNG ĐỊNH').setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
 cell.appendParagraph('TỔ CHUYÊN MÔN 4').setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
 cell.appendParagraph('_______________________________________').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
 body.appendParagraph('BIÊN BẢN HỌP TỔ CHUYÊN MÔN').setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);body.appendParagraph(item.title).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
 [['Thời gian',item.meetingTime],['Địa điểm',item.location||'........................................'],['Người chủ trì',item.chair],['Thư ký',item.secretary],['Thành phần tham dự',item.attendees||'........................................']].forEach(x=>{const q=body.appendParagraph('');q.appendText(x[0]+': ').setBold(true);q.appendText(x[1]);});
 [['I. Nội dung cuộc họp',item.agenda],['II. Nội dung nghiên cứu bài học/chuyên đề',item.researchTopic||'Không có.'],['III. Minh chứng và biểu hiện học tập của học sinh',item.evidence||'Không có.'],['IV. Ý kiến thảo luận',item.discussion],['V. Kết luận của chủ trì',item.conclusion],['VI. Phân công và thời hạn thực hiện',item.assignments||'Không có.']].forEach(x=>{body.appendParagraph(x[0]).setBold(true);body.appendParagraph(x[1]);});
 body.appendParagraph('Cuộc họp kết thúc lúc '+(item.endHour||'....')+' giờ '+(item.endMinute||'....')+' phút cùng ngày. Tất cả các thành viên tham gia dự họp thống nhất với nội dung cuộc họp./.');
 const sign=body.appendTable([['THƯ KÝ','ĐẠI DIỆN BAN GIÁM HIỆU','CHỦ TRÌ'],['','',''],[item.secretary,item.principalRepresentative||'',item.chair]]);sign.setBorderWidth(0);
 for(let col=0;col<3;col++){sign.getCell(0,col).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);sign.getCell(2,col).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);}addSignature_(sign.getCell(1,0),item.secretarySignatureUrl);addSignature_(sign.getCell(1,1),item.principalSignatureUrl);addSignature_(sign.getCell(1,2),item.chairSignatureUrl);
 body.appendParagraph('CÁC THÀNH VIÊN DỰ HỌP').setBold(true);const attendeeSign=body.appendTable([['']]);attendeeSign.setBorderWidth(0);attendeeSign.getCell(0,0).clear();addSignature_(attendeeSign.getCell(0,0),item.attendeesSignatureUrl);
 doc.saveAndClose();folder_('minutes').addFile(DriveApp.getFileById(doc.getId()));return doc;
}

function exportMeetingMinutesPdf(token,id){const user=requireUser_(token),db=db_(),item=read_(db,'Minutes').find(n=>n.id===id&&(user.role==='ADMIN'||user.role==='LEADER'||n.ownerEmail===user.email));if(!item)throw new Error('Không tìm thấy biên bản.');const pdf=folder_('minutes').createFile(DriveApp.getFileById(String(item.docId||'')||fileIdFromUrl_(item.docUrl)).getAs(MimeType.PDF).setName(safeFile_(item.title)+'.pdf'));updateWhere_(db,'Minutes',r=>r.id===id,r=>{r.pdfUrl=pdf.getUrl();return r});audit_(db,user,'EXPORT_MINUTES_PDF',id);return {pdfUrl:pdf.getUrl()};}

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
  updateWhere_(db,'Notebooks',r=>r.id===id,r=>{r.pdfUrl=pdf.getUrl();return r;});audit_(db,user,'EXPORT_NOTEBOOK_PDF',id);return {pdfUrl:pdf.getUrl()};
}

function expiry_(){const d=new Date();d.setDate(d.getDate()+TH50.RETENTION_DAYS);return Utilities.formatDate(d,TH50.TZ,"yyyy-MM-dd'T'HH:mm:ss");}
function fileIdFromUrl_(url){const m=String(url||'').match(/[-\w]{25,}/);return m?m[0]:'';}
function exportDocx_(docId,title,folder){const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(docId)+'/export?mimeType='+encodeURIComponent('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});if(response.getResponseCode()!==200)throw new Error('Không thể xuất Word từ Google Docs.');return folder.createFile(response.getBlob().setName(safeFile_(title)+'.docx'));}
function exportNotebookDocx(token,id){const user=requireUser_(token),db=db_(),item=read_(db,'Notebooks').find(n=>n.id===id&&(user.role==='ADMIN'||n.ownerEmail===user.email));if(!item)throw new Error('Không tìm thấy sổ họp.');const docId=String(item.docId||'')||fileIdFromUrl_(item.docUrl);if(!docId)throw new Error('Sổ họp chưa có mã Google Docs.');const file=exportDocx_(docId,item.title,folder_('notebooks'));updateWhere_(db,'Notebooks',r=>r.id===id,r=>{r.docxUrl=file.getUrl();return r});audit_(db,user,'EXPORT_NOTEBOOK_DOCX',id);return {docxUrl:file.getUrl()};}
function exportMeetingMinutesDocx(token,id){const user=requireUser_(token),db=db_(),item=read_(db,'Minutes').find(n=>n.id===id&&(user.role==='ADMIN'||user.role==='LEADER'||n.ownerEmail===user.email));if(!item)throw new Error('Không tìm thấy biên bản.');const docId=String(item.docId||'')||fileIdFromUrl_(item.docUrl);if(!docId)throw new Error('Biên bản chưa có mã Google Docs.');const file=exportDocx_(docId,item.title,folder_('minutes'));updateWhere_(db,'Minutes',r=>r.id===id,r=>{r.docxUrl=file.getUrl();return r});audit_(db,user,'EXPORT_MINUTES_DOCX',id);return {docxUrl:file.getUrl()};}
function createPersonalNotebookFromMinutes(token,minutesId,input){const user=requireRole_(token,['ADMIN','LEADER','DEPUTY','TEACHER']),db=db_(),m=read_(db,'Minutes').find(x=>x.id===minutesId&&(user.role==='ADMIN'||user.role==='LEADER'||x.ownerEmail===user.email));if(!m)throw new Error('Không tìm thấy biên bản đã chọn.');input=input||{};const content=['Nội dung cuộc họp: '+m.agenda,(m.discussion?'Ý kiến cần ghi nhớ: '+m.discussion:''),(m.conclusion?'Kết luận: '+m.conclusion:''),(m.assignments?'Nhiệm vụ cá nhân/Phân công: '+m.assignments:'')].filter(Boolean).join('\n\n');return saveNotebook(token,{title:cleanText_(input.title,160)||('CÁ NHÂN - '+m.title),meetingTime:m.meetingTime,chair:m.chair,creator:cleanText_(input.creator,120)||user.name,attendees:user.name,content:content});}
function cleanupExpiredDocuments(){const db=db_(),cut=Date.now();['Notebooks','Minutes'].forEach(name=>read_(db,name).forEach(item=>{if(item.status==='EXPIRED')return;let expires=item.expiresAt?new Date(item.expiresAt).getTime():0;if(!expires&&item.createdAt){const d=new Date(item.createdAt);d.setDate(d.getDate()+TH50.RETENTION_DAYS);expires=d.getTime()}if(expires&&expires<=cut){[item.docId||fileIdFromUrl_(item.docUrl),fileIdFromUrl_(item.pdfUrl),fileIdFromUrl_(item.docxUrl)].filter(Boolean).forEach(id=>{try{DriveApp.getFileById(id).setTrashed(true)}catch(e){}});updateWhere_(db,name,r=>r.id===item.id,r=>{r.status='EXPIRED';return r})}}));}
function installRetentionTrigger(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='cleanupExpiredDocuments').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('cleanupExpiredDocuments').timeBased().everyDays(1).atHour(2).create();return true;}

function logout(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('session:' + digest_(token));
  return true;
}

function db_() {
  const props=PropertiesService.getScriptProperties();let id=props.getProperty('dbId'),ss=id?SpreadsheetApp.openById(id):null;
  if(!ss){ss=SpreadsheetApp.create('Trường học 5.0 — Dữ liệu');props.setProperty('dbId',ss.getId());folder_('root').addFile(DriveApp.getFileById(ss.getId()));}
  if(props.getProperty('schemaVersion')!=='27'){
    [['Users',['id','email','name','phone','role','requestedRole','status','createdAt','approvedAt','approvedBy','personalFolderId','activationHash','activationExpiry','features']],['LoginCodes',['id','email','codeHash','expiresAt','used','createdAt','usedAt']],['Modules',['id','icon','name','description','deployUrl','scriptUrl','driveUrl','status','visible','order','updatedAt','updatedBy']],['Notebooks',['id','title','meetingTime','chair','attendees','content','ownerEmail','ownerName','createdAt','expiresAt','status','docId','docUrl','pdfUrl','docxUrl','signatureUrl']],['Minutes',['id','title','meetingTime','location','chair','secretary','principalRepresentative','attendees','agenda','researchTopic','evidence','discussion','conclusion','assignments','endHour','endMinute','ownerEmail','ownerName','createdAt','expiresAt','status','docId','docUrl','pdfUrl','docxUrl','secretarySignatureUrl','principalSignatureUrl','chairSignatureUrl','attendeesSignatureUrl']],['Audit',['id','at','email','action','target']]].forEach(x=>sheet_(ss,x[0],x[1]));props.setProperty('schemaVersion','27');
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
  const p=PropertiesService.getScriptProperties(), key='folder:'+kind; let id=p.getProperty(key);
  if(id) return DriveApp.getFolderById(id);
  let f;
  if(kind==='root') { const it=DriveApp.getFoldersByName(TH50.ROOT); f=it.hasNext()?it.next():DriveApp.createFolder(TH50.ROOT); }
  else { f=folder_('root').createFolder(kind==='notebooks'?'Sổ họp':kind==='minutes'?'Biên bản họp tổ chuyên môn':kind==='signatures'?'Chữ ký':'Không gian cá nhân'); }
  p.setProperty(key,f.getId()); return f;
}
function personalFolder_(user) {
  const root=folder_('personal'), name=safeFile_(user.name)+' — '+user.email; const it=root.getFoldersByName(name); return it.hasNext()?it.next():root.createFolder(name);
}
function issueToken_(user) {
  const token=Utilities.getUuid()+Utilities.getUuid().replace(/-/g,'');
  PropertiesService.getScriptProperties().setProperty('session:'+digest_(token), JSON.stringify({email:user.email,expires:Date.now()+TH50.TOKEN_HOURS*3600000}));
  return token;
}
function requireUser_(token) {
  if(!token) throw new Error('Phiên đăng nhập đã hết hạn.');
  const raw=PropertiesService.getScriptProperties().getProperty('session:'+digest_(token));
  if(!raw) throw new Error('Phiên đăng nhập đã hết hạn.'); const s=JSON.parse(raw);
  if(s.expires<Date.now()) {PropertiesService.getScriptProperties().deleteProperty('session:'+digest_(token));throw new Error('Phiên đăng nhập đã hết hạn.');}
  const u=read_(db_(),'Users').find(r=>r.email===s.email && r.status==='APPROVED'); if(!u) throw new Error('Tài khoản chưa được phê duyệt.');
  return u;
}
function requireRole_(token,roles){const u=requireUser_(token);if(roles.indexOf(u.role)<0)throw new Error('Cô/thầy không có quyền thực hiện chức năng này.');return u;}
function createNotebookDoc_(item) {
  const fileName=safeFile_(item.title||String(item.content||'').slice(0,80)||'Sổ họp'),doc=DocumentApp.create(fileName),body=doc.getBody();
  const table=body.appendTable([['']]);table.setBorderWidth(0);const cell=table.getCell(0,0);cell.clear();cell.appendParagraph('ỦY BAN NHÂN DÂN PHƯỜNG ĐÔNG HƯNG THUẬN').setAlignment(DocumentApp.HorizontalAlignment.CENTER);cell.appendParagraph('TRƯỜNG TIỂU HỌC TRƯƠNG ĐỊNH').setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);cell.appendParagraph('_______________________________________').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('SỔ HỌP '+item.title.toUpperCase()).setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Thời gian: '+item.meetingTime).setAlignment(DocumentApp.HorizontalAlignment.CENTER);body.appendParagraph('Người chủ trì: '+item.chair).setAlignment(DocumentApp.HorizontalAlignment.CENTER);body.appendParagraph('Người dự họp: '+(item.attendees||'........................................................'));body.appendParagraph('Nội dung:').setAlignment(DocumentApp.HorizontalAlignment.CENTER);body.appendParagraph(item.content);body.appendParagraph('Giáo viên').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);if(item.signatureUrl){try{const blob=signatureBlob_(item.signatureUrl);if(blob)body.appendImage(blob).setWidth(130)}catch(e){}}body.appendParagraph(item.ownerName).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);doc.saveAndClose();folder_('notebooks').addFile(DriveApp.getFileById(doc.getId()));return doc;
}
function saveSignature_(user, data) {
  const m=String(data).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!m) throw new Error('Chữ ký cần là ảnh PNG, JPG hoặc WebP.');
  const bytes=Utilities.base64Decode(m[2]); if(bytes.length>1024*1024) throw new Error('Ảnh chữ ký tối đa 1 MB.');
  const file=folder_('signatures').createFile(Utilities.newBlob(bytes,m[1],'signature-'+Date.now())); return file.getUrl();
}
function audit_(db,user,action,target){append_(db,'Audit',{id:Utilities.getUuid(),at:now_(),email:user.email,action:action,target:target});}
function publicUser_(u){return {email:u.email,name:u.name,phone:u.phone,role:u.role,status:u.status,features:u.role==='ADMIN'||u.role==='LEADER'?'all':String(u.features||'notebooks,meetings'),teamId:u.teamId||''};}
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
function ensureCollabSheets_(db){
 sheet_(db,'Users',['id','email','name','phone','role','requestedRole','status','createdAt','approvedAt','approvedBy','personalFolderId','activationHash','activationExpiry','features','teamId']);
 sheet_(db,'Teams',['id','name','schoolYear','active','createdAt','createdBy']);
 sheet_(db,'Memberships',['id','teamId','userEmail','role','status','className','phone','features','createdAt','createdBy']);
 sheet_(db,'Meetings',['id','teamId','title','startAt','endAt','location','description','attendeeEmails','secretaryEmail','calendarEventId','meetUrl','status','createdAt','createdBy']);
 sheet_(db,'Assignments',['id','teamId','meetingId','userEmail','assignmentType','status','createdAt','createdBy']);
 let teams=read_(db,'Teams');
 if(!teams.length){append_(db,'Teams',{id:'to-4',name:'Tổ chuyên môn 4',schoolYear:'2026-2027',active:true,createdAt:now_(),createdBy:TH50.ADMIN});teams=read_(db,'Teams');}
 return teams;
}
function activeTeamId_(u,db){ensureCollabSheets_(db);const own=read_(db,'Memberships').find(m=>m.userEmail===u.email&&m.status!=='DISABLED');return own&&own.teamId||'to-4';}
function listPublicTeams(){const db=db_();return {items:ensureCollabSheets_(db).filter(t=>asBool_(t.active)).map(t=>({id:t.id,name:t.name}))};}
function listTeams(token){const u=requireUser_(token),db=db_();return {items:ensureCollabSheets_(db).filter(t=>asBool_(t.active)||u.role==='ADMIN'),activeTeamId:activeTeamId_(u,db)};}
function saveTeam(token,input){const u=requireRole_(token,['ADMIN']),db=db_();ensureCollabSheets_(db);input=input||{};const name=cleanText_(input.name,100);if(!name)throw new Error('Vui lòng nhập tên tổ chuyên môn.');const item={id:cleanText_(input.id,80)||Utilities.getUuid(),name:name,schoolYear:cleanText_(input.schoolYear,30),active:input.active!==false,createdAt:now_(),createdBy:u.email};const old=read_(db,'Teams').some(x=>x.id===item.id);old?updateWhere_(db,'Teams',x=>x.id===item.id,()=>item):append_(db,'Teams',item);audit_(db,u,'SAVE_TEAM',item.id);return item;}
function listTeamMembers(token,teamId){const u=requireUser_(token),db=db_();ensureCollabSheets_(db);teamId=cleanText_(teamId,80)||activeTeamId_(u,db);const memberships=read_(db,'Memberships').filter(m=>m.teamId===teamId&&m.status!=='REMOVED'),users=read_(db,'Users');return {items:memberships.map(m=>{const x=users.find(z=>z.email===m.userEmail)||{};return Object.assign({},m,{name:x.name||m.userEmail,email:m.userEmail,accountStatus:x.status||m.status,features:m.features||x.features||''});})};}
function addTeamMember(token,input){const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);input=input||{};const email=cleanEmail_(input.email),name=cleanText_(input.name,100),phone=cleanText_(input.phone,25),teamId=cleanText_(input.teamId,80)||activeTeamId_(actor,db),role=['LEADER','DEPUTY','TEACHER'].indexOf(input.role)>=0?input.role:'TEACHER';if(!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Vui lòng nhập đúng họ tên và email.');if(actor.role==='LEADER'&&teamId!==activeTeamId_(actor,db))throw new Error('Tổ trưởng chỉ được thêm thành viên vào tổ của mình.');let user=read_(db,'Users').find(x=>x.email===email);if(!user){user={id:Utilities.getUuid(),email:email,name:name,phone:phone,role:role,status:'INVITED',createdAt:now_(),approvedAt:now_(),approvedBy:actor.email,personalFolderId:'',activationHash:'',activationExpiry:'',features:'notebooks,meetings'};append_(db,'Users',user);}const exists=read_(db,'Memberships').find(x=>x.teamId===teamId&&x.userEmail===email);const member={id:exists&&exists.id||Utilities.getUuid(),teamId:teamId,userEmail:email,role:role,status:'INVITED',className:cleanText_(input.className,80),phone:phone,features:'notebooks,meetings',createdAt:exists&&exists.createdAt||now_(),createdBy:actor.email};exists?updateWhere_(db,'Memberships',x=>x.id===exists.id,()=>member):append_(db,'Memberships',member);const code=('000000'+Math.floor(Math.random()*1000000)).slice(-6);updateWhere_(db,'Users',x=>x.email===email,x=>Object.assign(x,{name:name,phone:phone,role:role,status:'INVITED',activationHash:digest_(code),activationExpiry:Date.now()+7*86400000}));MailApp.sendEmail({to:email,subject:'Mời tham gia '+(read_(db,'Teams').find(t=>t.id===teamId)||{name:'tổ chuyên môn'}).name+' — Trường học 5.0',htmlBody:'<p>Xin chào '+escapeHtml_(name)+',</p><p>Cô/thầy đã được thêm vào không gian tổ chuyên môn.</p><p>Mã kích hoạt: <b style="font-size:22px;letter-spacing:4px">'+code+'</b></p><p><a href="'+ScriptApp.getService().getUrl()+'?activate=1&email='+encodeURIComponent(email)+'">Kích hoạt tài khoản</a></p>',name:'Trường học 5.0'});audit_(db,actor,'ADD_TEAM_MEMBER',email+':'+teamId);return member;}
function assignMeetingSecretary(token,meetingId,email){const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);const meeting=read_(db,'Meetings').find(x=>x.id===meetingId);if(!meeting)throw new Error('Không tìm thấy lịch họp.');email=cleanEmail_(email);const item={id:Utilities.getUuid(),teamId:meeting.teamId,meetingId:meetingId,userEmail:email,assignmentType:'SECRETARY',status:'ACTIVE',createdAt:now_(),createdBy:actor.email};append_(db,'Assignments',item);updateWhere_(db,'Users',x=>x.email===email,x=>{const f=String(x.features||'').split(',').filter(Boolean);if(f.indexOf('minutes')<0)f.push('minutes');x.features=f.join(',');return x;});audit_(db,actor,'ASSIGN_SECRETARY',meetingId+':'+email);return item;}
function createMeeting(token,input){const actor=requireRole_(token,['ADMIN','LEADER']),db=db_();ensureCollabSheets_(db);input=input||{};const title=cleanText_(input.title,180),start=new Date(input.startAt||input.when),end=new Date(input.endAt||start.getTime()+60*60000),teamId=cleanText_(input.teamId,80)||activeTeamId_(actor,db);if(!title||isNaN(start.getTime()))throw new Error('Vui lòng nhập tên và thời gian họp hợp lệ.');const members=read_(db,'Memberships').filter(m=>m.teamId===teamId&&m.status!=='DISABLED'),emails=(Array.isArray(input.attendeeEmails)?input.attendeeEmails:members.map(m=>m.userEmail)).map(cleanEmail_).filter(Boolean);CalendarApp.getDefaultCalendar().getId();const event={summary:title,location:cleanText_(input.location||input.place,180),description:cleanText_(input.description,4000),start:{dateTime:start.toISOString(),timeZone:TH50.TZ},end:{dateTime:end.toISOString(),timeZone:TH50.TZ},attendees:emails.map(email=>({email:email})),conferenceData:{createRequest:{requestId:Utilities.getUuid(),conferenceSolutionKey:{type:'hangoutsMeet'}}}};const response=UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify(event),muteHttpExceptions:true});if(response.getResponseCode()>=300)throw new Error('Không tạo được lịch Google/Meet: '+response.getContentText().slice(0,300));const created=JSON.parse(response.getContentText()),item={id:Utilities.getUuid(),teamId:teamId,title:title,startAt:start.toISOString(),endAt:end.toISOString(),location:event.location,description:event.description,attendeeEmails:emails.join(','),secretaryEmail:cleanEmail_(input.secretaryEmail),calendarEventId:created.id||'',meetUrl:created.hangoutLink||'',status:'ACTIVE',createdAt:now_(),createdBy:actor.email};append_(db,'Meetings',item);if(item.secretaryEmail)assignMeetingSecretary(token,item.id,item.secretaryEmail);audit_(db,actor,'CREATE_MEETING',item.id);return item;}
function deleteNotebook(token,id){const u=requireUser_(token),db=db_(),item=read_(db,'Notebooks').find(n=>n.id===id);if(!item||item.status==='DELETED')throw new Error('Không tìm thấy sổ họp.');if(u.role!=='ADMIN'&&item.ownerEmail!==u.email)throw new Error('Cô/thầy không có quyền xóa sổ họp này.');[item.docId,fileIdFromUrl_(item.pdfUrl),fileIdFromUrl_(item.docxUrl),fileIdFromUrl_(item.signatureUrl)].filter(Boolean).forEach(fid=>{try{DriveApp.getFileById(fid).setTrashed(true)}catch(e){}});updateWhere_(db,'Notebooks',n=>n.id===id,n=>{n.status='DELETED';return n;});audit_(db,u,'DELETE_NOTEBOOK',id);return {deleted:true};}
function getAiStatus(token){requireUser_(token);return {configured:!!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),model:'gemini-3.8-flash'};}
function setGeminiApiKey(token,key){requireRole_(token,['ADMIN']);key=String(key||'').trim();if(!key)throw new Error('Vui lòng nhập API key Gemini.');PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY',key);return {configured:true,model:'gemini-3.8-flash'};}
function geminiAssistant(token,input){const u=requireUser_(token);input=input||{};const key=PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');if(!key)throw new Error('Admin chưa cấu hình API key Gemini trong Cài đặt.');const mode=String(input.mode||'lesson'),question=cleanText_(input.question,6000),context=cleanText_(input.context,30000);let instruction=mode==='text'?'Bạn là trợ lý phân tích văn bản cho giáo viên. Phân tích mục đích, ý chính, yêu cầu cần xử lý, rủi ro và đề xuất các bước cụ thể bằng tiếng Việt.':mode==='research'?'Bạn là trợ lý nghiên cứu bài học theo Công văn 4069/BGDĐT-GDPT. Tập trung vào hoạt động học và sự tiến bộ của học sinh, đề xuất minh chứng quan sát, điều chỉnh bài học; không xếp loại giáo viên.':'Bạn là trợ lý phân tích bài học/chủ đề SGK tiểu học. Xác định mục tiêu, yêu cầu cần đạt, khó khăn dự kiến, hoạt động học tích cực, câu hỏi đánh giá và điều chỉnh cho học sinh.';const parts=[{text:instruction+'\n\nNội dung/tài liệu:\n'+context+'\n\nYêu cầu của người dùng: '+(question||'Hãy phân tích và đề xuất hoạt động phù hợp.')}];if(input.fileData){const m=String(input.fileData).match(/^data:([^;]+);base64,(.+)$/);if(!m)throw new Error('Tệp tải lên không hợp lệ.');if(m[2].length>12000000)throw new Error('Tệp quá lớn. Vui lòng dùng tệp dưới khoảng 8 MB.');parts.push({inlineData:{mimeType:m[1],data:m[2]}});}const response=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key='+encodeURIComponent(key),{method:'post',contentType:'application/json',payload:JSON.stringify({contents:[{role:'user',parts:parts}],generationConfig:{temperature:0.35,maxOutputTokens:4096}}),muteHttpExceptions:true});if(response.getResponseCode()>=300)throw new Error('Gemini chưa phản hồi: '+response.getContentText().slice(0,300));const body=JSON.parse(response.getContentText()),answer=((body.candidates||[])[0]||{}).content;const text=((answer&&answer.parts)||[]).map(p=>p.text||'').join('\n');if(!text)throw new Error('Gemini chưa tạo được nội dung.');audit_(db_(),u,'AI_'+mode.toUpperCase(),'gemini-3.8-flash');return {text:text,model:'gemini-3.8-flash'};}

// Release 13: separate admin principal from personal account.

// Release 20: durable registration queue and notebook document ID.
