/**
 * Trường học 5.0 — máy chủ dữ liệu Apps Script.
 * Dữ liệu lưu trong Drive và Google Sheets thuộc tài khoản triển khai.
 */
const TH50 = Object.freeze({
  ADMIN: 'hcmtranle@gmail.com',
  ROOT: 'Trường học 5.0',
  TZ: 'Asia/Ho_Chi_Minh',
  TOKEN_HOURS: 8,
  CODE_MINUTES: 10
});

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Trường học 5.0 · Tổ chuyên môn 4')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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
  return {
    user: publicUser_(user),
    modules: read_(db, 'Modules').filter(m => user.role === 'ADMIN' || asBool_(m.visible)).sort((a,b) => String(a.order).localeCompare(String(b.order))),
    notebooks: read_(db, 'Notebooks').filter(n => user.role === 'ADMIN' || n.ownerEmail === user.email).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    approvals: user.role === 'ADMIN' ? read_(db, 'Users').filter(u => u.status === 'PENDING') : []
  };
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

function saveNotebook(token, input) {
  const user = requireRole_(token, ['ADMIN','LEADER','DEPUTY']), db = db_();
  input = input || {};
  const title = cleanText_(input.title, 160), chair = cleanText_(input.chair, 120), content = cleanText_(input.content, 20000);
  if (!title || !chair || !content) throw new Error('Vui lòng điền tên sổ họp, người chủ trì và nội dung triển khai.');
  const time = cleanText_(input.meetingTime, 80) || Utilities.formatDate(new Date(), TH50.TZ, 'dd/MM/yyyy HH:mm');
  const item = {id:Utilities.getUuid(), title:title, meetingTime:time, chair:chair, content:content, ownerEmail:user.email, ownerName:user.name, createdAt:now_(), docUrl:'', pdfUrl:'', signatureUrl:''};
  if (input.signatureData) item.signatureUrl = saveSignature_(user, input.signatureData);
  const doc = createNotebookDoc_(item);
  const folder = folder_('notebooks');
  const pdf = folder.createFile(doc.getAs(MimeType.PDF).setName('So_hop_' + safeFile_(title) + '.pdf'));
  item.docUrl = doc.getUrl(); item.pdfUrl = pdf.getUrl();
  append_(db, 'Notebooks', item); audit_(db, user, 'CREATE_NOTEBOOK', item.id);
  return item;
}

function logout(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('session:' + digest_(token));
  return true;
}

function db_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('dbId');
  let ss = id ? SpreadsheetApp.openById(id) : null;
  if (!ss) {
    ss = SpreadsheetApp.create('Trường học 5.0 — Dữ liệu');
    props.setProperty('dbId', ss.getId());
    folder_('root').addFile(DriveApp.getFileById(ss.getId()));
  }
  [['Users',['id','email','name','phone','role','status','createdAt','approvedAt','approvedBy','personalFolderId']],
   ['LoginCodes',['id','email','codeHash','expiresAt','used','createdAt','usedAt']],
   ['Modules',['id','icon','name','description','deployUrl','scriptUrl','driveUrl','status','visible','order','updatedAt','updatedBy']],
   ['Notebooks',['id','title','meetingTime','chair','content','ownerEmail','ownerName','createdAt','docUrl','pdfUrl','signatureUrl']],
   ['Audit',['id','at','email','action','target']]].forEach(x => sheet_(ss,x[0],x[1]));
  return ss;
}
function sheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}
function read_(ss, name) {
  const sh = ss.getSheetByName(name), v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const h=v[0]; return v.slice(1).filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(h.map((k,i)=>[k,r[i]])));
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
  else { f=folder_('root').createFolder(kind==='notebooks'?'Sổ họp':kind==='signatures'?'Chữ ký':'Không gian cá nhân'); }
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
  const doc=DocumentApp.create('Sổ họp — '+item.title), body=doc.getBody();
  body.appendParagraph('ỦY BAN NHÂN DÂN PHƯỜNG ĐÔNG HƯNG THUẬN').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('TRƯỜNG TIỂU HỌC TRƯƠNG ĐỊNH').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('---------------------------------------').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('SỔ HỌP ' + item.title.toUpperCase()).setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Thời gian: '+item.meetingTime).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Người chủ trì: '+item.chair).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Nội dung:').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph(item.content);
  body.appendParagraph('\n\n\nGiáo viên').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  if(item.signatureUrl) { try { body.appendImage(UrlFetchApp.fetch(item.signatureUrl).getBlob()).setWidth(130); } catch(e){} }
  body.appendParagraph(item.ownerName).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  doc.saveAndClose(); folder_('notebooks').addFile(DriveApp.getFileById(doc.getId())); return doc;
}
function saveSignature_(user, data) {
  const m=String(data).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!m) throw new Error('Chữ ký cần là ảnh PNG, JPG hoặc WebP.');
  const bytes=Utilities.base64Decode(m[2]); if(bytes.length>1024*1024) throw new Error('Ảnh chữ ký tối đa 1 MB.');
  const file=folder_('signatures').createFile(Utilities.newBlob(bytes,m[1],'signature-'+Date.now())); return file.getUrl();
}
function audit_(db,user,action,target){append_(db,'Audit',{id:Utilities.getUuid(),at:now_(),email:user.email,action:action,target:target});}
function publicUser_(u){return {email:u.email,name:u.name,phone:u.phone,role:u.role,status:u.status};}
function cleanText_(v,n){return String(v||'').trim().replace(/[<>]/g,'').slice(0,n);}
function cleanEmail_(v){return cleanText_(v,254).toLowerCase();}
function safeUrl_(v){v=String(v||'').trim();if(!v)return '';if(!/^https:\/\//i.test(v))throw new Error('Liên kết phải bắt đầu bằng https://');return v.slice(0,1000);}
function safeFile_(v){return String(v).replace(/[\\/:*?"<>|]/g,'-').slice(0,100);}
function digest_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v)).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('');}
function now_(){return Utilities.formatDate(new Date(),TH50.TZ,"yyyy-MM-dd'T'HH:mm:ss");}
function asBool_(v){return v===true||String(v).toLowerCase()==='true';}
function suggestIcon_(s){s=String(s).toLowerCase();if(/họp|chuyên môn/.test(s))return '👥';if(/bài giảng|học sinh|lớp/.test(s))return '📚';if(/drive|học liệu/.test(s))return '📁';if(/thi đua|điểm/.test(s))return '🏆';if(/lịch/.test(s))return '🗓️';return '🧩';}
function escapeHtml_(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
