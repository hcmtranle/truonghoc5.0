
'use strict';
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  school:'M3 10 12 4l9 6M5 9v11h14V9M9 20v-6h6v6M9 10h.01M15 10h.01M2 20h20',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  calendar:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 14h2M15 14h2M7 18h2',
  book:'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-4-2-7-1-10 1',
  spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3M20 2v4M18 4h4',
  folder:'M3 7V4h6l2 3h10v13H3V7z',
  award:'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M9 12l-2 9 5-3 5 3-2-9',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  plus:'M12 5v14M5 12h14',upload:'M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6',
  download:'M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5',arrow:'M5 12h14m-5-5 5 5-5 5',
  menu:'M3 6h18M3 12h18M3 18h18',check:'m5 12 4 4L19 6',clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  edit:'m16 3 5 5-12 12H4v-5L16 3z',shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4',
};
const icon = name => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name] || paths.folder)+'"/></svg>';
$$('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const Model = SchoolModel, KEY='truonghoc50.preview.v1';
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
let data={members:[],events:[],notes:[]}, storageProblem='', page='overview', pendingRows=[];
try {
  const saved=localStorage.getItem(KEY);
  if(saved) {
    const parsed=JSON.parse(saved);
    if(!parsed || !['members','events','notes'].every(k=>Array.isArray(parsed[k]))) throw Error('Dữ liệu cũ không đúng định dạng.');
    data=parsed;
  }
} catch(e) { storageProblem='Không đọc được dữ liệu trên trình duyệt. Dữ liệu mới chỉ giữ trong phiên hiện tại.'; }
function persist(next) {
  try { localStorage.setItem(KEY,JSON.stringify(next)); }
  catch(e) { toast('Không lưu được: bộ nhớ trình duyệt không khả dụng hoặc đã đầy. Thay đổi chưa được áp dụng.'); return false; }
  data=next; return true;
}
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,5500); }
const navItems=[['overview','grid','Tổng quan'],['members','users','Thành viên'],['meetings','calendar','Lịch họp & điểm danh'],['research','book','Nghiên cứu bài học'],['lessons','spark','Bài giảng tương tác'],['awards','award','Thi đua'],['personal','folder','Không gian cá nhân'],['settings','settings','Cài đặt']];
$('#nav').innerHTML=navItems.map(([id,i,title],n)=>(n===6?'<div class="nav-label">KHÔNG GIAN CỦA TÔI</div>':'')+'<button data-page="'+id+'">'+icon(i)+title+'</button>').join('');
$('#nav').addEventListener('click',e=>{const btn=e.target.closest('[data-page]');if(btn) navigate(btn.dataset.page);});
function closeMenu(){ $('#sidebar').classList.remove('open');$('#shade').classList.remove('show');$('#menu-toggle').setAttribute('aria-expanded','false'); }
$('#menu-toggle').onclick=()=>{ const opened=$('#sidebar').classList.toggle('open');$('#shade').classList.toggle('show',opened);$('#menu-toggle').setAttribute('aria-expanded',String(opened)); };
$('#shade').onclick=closeMenu;
function navigate(id) {page=id;closeMenu();render();$('#main').focus({preventScroll:true});window.scrollTo(0,0);}
function heading(title,description,actions=''){return '<div class="heading"><div><h1>'+title+'</h1><p>'+description+'</p></div><div>'+actions+'</div></div>';}
function button(label,action,i='plus',primary=false){return '<button class="btn'+(primary?' primary':'')+'" data-action="'+action+'">'+icon(i)+label+'</button>';}
const previewNotice='<div class="notice"><strong>Không gian trải nghiệm giao diện</strong>Dữ liệu chỉ lưu trên trình duyệt này. Chưa đăng nhập, chưa đồng bộ Drive và chưa gửi thông báo. Cô vui lòng dùng dữ liệu thử.</div>';
function empty(title,description,action=''){return '<div class="empty">'+icon('folder')+'<strong>'+title+'</strong><p>'+description+'</p>'+action+'</div>';}
function initials(name){return String(name).trim().split(/\s+/).slice(-2).map(s=>s[0]||'').join('').toUpperCase();}
function avatar(m){const photo=typeof m.photo==='string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(m.photo)?'<img src="'+m.photo+'" alt="">':esc(initials(m.name));return '<span class="avatar">'+photo+'</span>';}
function render() {
  $$('#nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
  const title=navItems.find(n=>n[0]===page)?.[2]||'Tổng quan';
  $('#main').innerHTML='<div class="breadcrumb">Không gian chung <span>/</span> Tổ chuyên môn 4 <span>/</span> '+title+'</div>'+(storageProblem?'<div class="error" role="alert">'+esc(storageProblem)+'</div>':'')+({overview:overview,members:members,meetings:meetings,research:research,lessons:lessons,awards:awards,personal:personal,settings:settings}[page]||overview)()+'<footer class="footer"><span>Hệ thống được thiết kế bởi <strong>Cô Trần Thị Thu Hương</strong> và <strong>thầy Lê Thành Tạo</strong>.</span><span>Mọi đóng góp xin gửi về: <a href="mailto:hcmtranle@gmail.com">hcmtranle@gmail.com</a></span></footer>';
  bindPage();
}
function stat(label,value,note,i,gold=false){return '<div class="stat"><div class="stat-top">'+label+'<span class="stat-icon'+(gold?' gold':'')+'">'+icon(i)+'</span></div><div class="stat-value">'+value+'</div><div class="stat-note">'+note+'</div></div>';}
const schoolArt='<svg class="hero-art" viewBox="0 0 260 190" fill="none" aria-hidden="true"><circle cx="155" cy="95" r="80" fill="#dde8d3"/><path d="M15 164h230" stroke="#bfd1b5" stroke-width="2"/><path d="M59 81h139v83H59z" fill="#fffdf3"/><path d="m47 82 83-48 83 48" fill="#a8b895"/><path d="M95 77h65v87H95z" fill="#f5efd9"/><path d="m86 77 43-43 42 43" fill="#668369"/><path d="M119 128h19v36h-19z" fill="#71937b"/><path d="M70 101h14v19H70zM173 101h14v19h-14zM70 136h14v18H70zM173 136h14v18h-14z" fill="#bad3be"/><circle cx="129" cy="96" r="12" fill="#fffdf6"/><path d="M129 87v9l5 3" stroke="#6a846b" stroke-width="2"/><path d="M128 34V14" stroke="#8a9e7a" stroke-width="2"/><path d="M130 14h24l-6 7 6 7h-24" fill="#cba671"/><path d="M34 165v-29M229 165v-41" stroke="#7f9673" stroke-width="3"/><ellipse cx="34" cy="128" rx="19" ry="24" fill="#b1c8a0"/><ellipse cx="229" cy="119" rx="21" ry="30" fill="#97b38d"/><path d="M102 164h52l14 13H88z" fill="#cbd6bb"/></svg>';
function overview(){
 const upcoming=data.events.filter(e=>new Date(e.when)>=new Date()).sort((a,b)=>a.when.localeCompare(b.when));
 return heading('Một ngày cùng tổ chuyên môn','Cùng kết nối, chia sẻ và phát triển chuyên môn mỗi ngày.',button('Tạo lịch họp','new-meeting','plus',true))+
 '<section class="hero"><div class="hero-text"><div class="eyebrow">CHÀO MỪNG ĐẾN VỚI TRƯỜNG HỌC 5.0</div><h2>Đồng hành cùng thầy cô,<br>vun đắp những bài học hay.</h2><p>Không gian chuyên môn chung của Tổ chuyên môn 4.</p>'+button('Khám phá thành viên','go-members','arrow')+'</div>'+schoolArt+'</section>'+
 '<div class="stats">'+stat('Thành viên',data.members.length,'Hồ sơ trong bản xem thử','users')+stat('Lịch sắp tới',upcoming.length,'Lịch họp và sinh hoạt tổ','calendar')+stat('Ghi chú cá nhân',data.notes.length,'Lưu trên trình duyệt này','book')+stat('Module đang thử','03','Thành viên · Lịch họp · Cá nhân','grid',true)+'</div>'+
 '<div class="columns"><div><section class="panel"><div class="panel-head"><h2>Lịch hoạt động sắp tới</h2><button class="text-btn" data-action="go-meetings">Xem tất cả →</button></div>'+(upcoming.length?upcoming.slice(0,3).map(eventCard).join(''):empty('Chưa có lịch hoạt động','Cô tạo lịch họp đầu tiên để cả tổ cùng theo dõi.',button('Tạo lịch họp','new-meeting','plus')))+'</section><section class="panel"><div class="panel-head"><h2>Thành viên trong tổ</h2><button class="text-btn" data-action="go-members">Quản lý thành viên →</button></div>'+(data.members.length?'<div style="display:flex;gap:10px;flex-wrap:wrap">'+data.members.slice(0,8).map(m=>'<div title="'+esc(m.name)+'">'+avatar(m)+'</div>').join('')+'</div>':empty('Bắt đầu từ những người đồng hành','Tải mẫu Excel rồi kéo thả danh sách để tạo hồ sơ thành viên.',button('Nhập danh sách','import','upload')))+'</section></div>'+
 '<div><section class="panel"><div class="panel-head"><h2>Thao tác nhanh</h2></div><div class="quick-grid">'+[['import','upload','Nhập Excel','Thêm thành viên vào tổ'],['new-meeting','calendar','Tạo lịch họp','Sắp xếp hoạt động chung'],['go-research','book','Nghiên cứu bài học','Cùng xây dựng bài dạy'],['go-personal','folder','Không gian cá nhân','Lưu những ý tưởng hay']].map(([a,i,t,s])=>'<button class="quick" data-action="'+a+'">'+icon(i)+'<strong>'+t+'</strong><small>'+s+'</small></button>').join('')+'</div></section>'+previewNotice+'</div></div>';
}
function members(){return heading('Thành viên trong tổ','Mỗi thầy cô là một phần của tập thể Trương Định.',button('Thêm thành viên','new-member','plus',true))+'<section class="panel"><div class="toolbar"><input id="member-search" class="search" aria-label="Tìm thành viên" placeholder="Tìm họ tên, email hoặc lớp dạy…"><select id="role-filter" aria-label="Lọc chức danh"><option value="">Tất cả chức danh</option>'+Model.roles.map(r=>'<option>'+r+'</option>').join('')+'</select>'+button('Tải mẫu Excel','template','download')+button('Nhập Excel','import','upload')+'</div><div id="member-table">'+memberTable(data.members)+'</div></section>'+previewNotice;}
function memberTable(list){return list.length?'<div class="table-wrap"><table><thead><tr><th>GIÁO VIÊN</th><th>CHỨC DANH</th><th>LỚP DẠY</th><th>ĐIỆN THOẠI</th><th>HỒ SƠ</th></tr></thead><tbody>'+list.map(m=>'<tr><td class="person">'+avatar(m)+'<div><strong>'+esc(m.name)+'</strong><small>'+esc(m.email)+'</small></div></td><td><span class="badge">'+esc(m.role)+'</span></td><td>'+esc(m.className||'—')+'</td><td>'+esc(m.phone||'—')+'</td><td><button class="text-btn" data-edit-member="'+esc(m.id)+'" aria-label="Sửa hồ sơ '+esc(m.name)+'">Chỉnh sửa</button></td></tr>').join('')+'</tbody></table></div>':empty('Chưa có thành viên phù hợp','Cô có thể thêm từng thành viên hoặc nhập danh sách từ file Excel.');}
function eventCard(e){const d=new Date(e.when);return '<div class="event"><div class="date-box"><strong>'+d.getDate()+'</strong><small>TH '+(d.getMonth()+1)+'</small></div><div class="event-body"><strong>'+esc(e.title)+'</strong><p>'+d.toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'})+' · '+esc(e.place)+'</p><p>'+esc(e.description||'Sinh hoạt chuyên môn của tổ')+'</p><button class="btn" data-attend="'+esc(e.id)+'">'+icon('check')+'Điểm danh ('+Object.values(e.attendance||{}).filter(Boolean).length+')</button> <button class="text-btn" data-edit-event="'+esc(e.id)+'">Sửa lịch</button></div></div>';}
function meetings(){return heading('Lịch họp & điểm danh','Sắp xếp hoạt động, ghi nhận sự tham gia của từng thành viên.',button('Tạo lịch họp','new-meeting','plus',true))+'<section class="panel"><div class="panel-head"><h2>Lịch hoạt động của tổ</h2><span class="badge">'+data.events.length+' hoạt động</span></div>'+(data.events.length?[...data.events].sort((a,b)=>a.when.localeCompare(b.when)).map(eventCard).join(''):empty('Cùng tạo lịch hoạt động đầu tiên','Thông báo email và điện thoại sẽ được bổ sung sau khi kết nối dịch vụ.',button('Tạo lịch họp','new-meeting','plus',true)))+'</section>'+previewNotice;}
function roadmap(title,subtitle,items){return heading(title,subtitle)+'<div class="notice"><strong>Phác thảo module · Chưa kích hoạt</strong>Các bước dưới đây giúp cô góp ý về bố cục và quy trình. Bản này chưa xử lý nghiệp vụ của module.</div><div class="feature-grid">'+items.map(([t,d],i)=>'<section class="feature"><span class="step">0'+(i+1)+'</span><h3>'+t+'</h3><p>'+d+'</p><span class="badge">Dự kiến</span></section>').join('')+'</div>';}
function research(){return roadmap('Nghiên cứu bài học','Cùng quan sát việc học của học sinh, cùng cải tiến bài dạy.',[['Xây dựng bài học','Chọn vấn đề, xác định mục tiêu và cùng đóng góp vào kế hoạch bài dạy.'],['Dạy minh họa & quan sát','Tập trung quan sát hoạt động học của học sinh, lưu ghi chép và minh chứng.'],['Suy ngẫm & vận dụng','Thảo luận kết quả, điều chỉnh bài dạy và lưu bài học kinh nghiệm của tổ.']]);}
function lessons(){return roadmap('Bài giảng tương tác','Từ học liệu của thầy cô đến những trải nghiệm học tập sinh động.',[['Chọn học liệu','Chọn Lớp → Môn → Tuần → Bài và nguồn học liệu từ Google Drive.'],['Thiết kế cùng Gemini','Tạo nội dung tương tác, câu hỏi và hoạt động; giáo viên duyệt trước khi sử dụng.'],['Tương tác & tạo trò chơi','Phát triển trò chơi từ ý tưởng học sinh và lưu bài giảng về Drive.']]);}
function awards(){return roadmap('Thi đua & minh chứng','Ghi nhận đóng góp của từng thành viên bằng tiêu chí rõ ràng.',[['Bộ tiêu chí của tổ','Thiết lập tiêu chí, thang điểm và thời gian áp dụng theo năm học.'],['Đóng góp & minh chứng','Thành viên gửi minh chứng cho hoạt động và nhiệm vụ đã thực hiện.'],['Duyệt & tổng hợp','Tổ trưởng kiểm tra, ghi nhận điều chỉnh và tổng hợp kết quả theo kỳ.']]);}
function personal(){return heading('Không gian cá nhân','Một góc dành cho ý tưởng và học liệu của thầy cô.',button('Viết ghi chú','new-note','plus',true))+'<div class="notice"><strong>Đang xem thử không gian cá nhân</strong>Chưa có tài khoản hoặc phân quyền thật. Ghi chú lưu trong trình duyệt này và có thể được người dùng chung trình duyệt xem. Chưa kết nối Google Drive.</div><section class="panel"><div class="panel-head"><h2>Ghi chú của tôi</h2><span class="badge">'+data.notes.length+' ghi chú</span></div>'+(data.notes.length?data.notes.map(n=>'<article class="note"><h3>'+esc(n.title)+'</h3><p>'+esc(n.body)+'</p><button class="text-btn" data-edit-note="'+esc(n.id)+'">Chỉnh sửa</button></article>').join(''):empty('Lưu lại một ý tưởng hay','Ghi lại điều cô muốn thử trong tiết học hoặc buổi sinh hoạt tiếp theo.',button('Viết ghi chú đầu tiên','new-note','plus')))+'</section>';}
function settings(){return heading('Cài đặt không gian','Thông tin chung và trạng thái kết nối của bản xem thử.')+'<section class="panel"><h2>Thông tin đơn vị</h2><p class="small muted">ỦY BAN NHÂN DÂN PHƯỜNG ĐÔNG HƯNG THUẬN</p><h3>Trường Tiểu học Trương Định</h3><p>Tổ chuyên môn 4</p><p class="small muted">Thiết kế cho phép bổ sung tổ sau này. Chưa có chức năng tạo tổ trong bản này.</p></section><section class="panel"><h2>Kết nối & tài khoản</h2><div class="check"><span>Google Drive</span><span class="badge">Chưa kết nối</span></div><div class="check"><span>Đăng ký · Admin duyệt · Không gian cá nhân</span><span class="badge">Chưa kích hoạt</span></div><div class="check"><span>Email, điện thoại và Gemini</span><span class="badge">Chưa kết nối</span></div></section><section class="panel"><h2>Dữ liệu trải nghiệm</h2><p class="small muted">Thêm dữ liệu minh họa để xem bố cục có nội dung. Chỉ khả dụng khi danh sách và lịch đều trống.</p>'+button('Thêm dữ liệu minh họa','seed','plus')+' <button class="btn danger" data-action="reset">Xóa dữ liệu thử trên trình duyệt</button></section>';}
const actions={'new-member':()=>memberDialog(),'import':importDialog,'template':downloadTemplate,'new-meeting':()=>meetingDialog(),'new-note':()=>noteDialog(),'seed':seed,'reset':resetData};
$('#main').addEventListener('click',e=>{
 const m=e.target.closest('[data-edit-member]'); if(m)return memberDialog(data.members.find(x=>x.id===m.dataset.editMember));
 const a=e.target.closest('[data-attend]');if(a)return attendanceDialog(data.events.find(x=>x.id===a.dataset.attend));
 const ev=e.target.closest('[data-edit-event]');if(ev)return meetingDialog(data.events.find(x=>x.id===ev.dataset.editEvent));
 const n=e.target.closest('[data-edit-note]');if(n)return noteDialog(data.notes.find(x=>x.id===n.dataset.editNote));
 const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
 if(action.startsWith('go-'))navigate(action.slice(3));else actions[action]?.();
});
function bindPage(){if(page==='members'){const filter=()=>{const q=$('#member-search').value.toLocaleLowerCase('vi').trim(),role=$('#role-filter').value;$('#member-table').innerHTML=memberTable(data.members.filter(m=>(!role||m.role===role)&&[m.name,m.email,m.className].some(v=>String(v).toLocaleLowerCase('vi').includes(q))));};$('#member-search').oninput=filter;$('#role-filter').onchange=filter;}}
const dialog=$('#dialog');
function openDialog(title,body,wide=false){dialog.classList.toggle('wide',wide);dialog.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button class="dialog-close" aria-label="Đóng">×</button></div>'+body;$('.dialog-close',dialog).onclick=()=>dialog.close();$$('[data-close]',dialog).forEach(b=>b.onclick=()=>dialog.close());if(!dialog.open)dialog.showModal();}
function field(label,name,value='',type='text',required=false){return '<label class="field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required ':'')+'maxlength="'+(name==='name'?100:254)+'"></label>';}
function formActions(label='Lưu thay đổi'){return '<div class="error" id="form-error" role="alert"></div><div class="dialog-actions"><button type="button" class="btn" data-close>Hủy</button><button class="btn primary" type="submit">'+label+'</button></div>';}
function memberDialog(member){
 openDialog(member?'Chỉnh sửa hồ sơ':'Thêm thành viên','<form id="member-form"><div class="fields">'+field('Họ và tên *','name',member?.name||'','text',true)+field('Email *','email',member?.email||'','email',true)+field('Số điện thoại','phone',member?.phone||'','tel')+'<label class="field">Chức danh *<select name="role">'+Model.roles.map(r=>'<option'+(r===(member?.role||'Tổ viên')?' selected':'')+'>'+r+'</option>').join('')+'</select></label>'+field('Lớp dạy','className',member?.className||'')+'<label class="field">Ảnh giáo viên (tối đa 500 KB)<input type="file" id="photo" accept="image/png,image/jpeg,image/webp"></label></div><p class="small muted">Tạo hồ sơ chưa đồng nghĩa với cấp tài khoản đăng nhập.</p>'+formActions(member?'Lưu hồ sơ':'Thêm thành viên')+'</form>');
 $('#member-form').onsubmit=async e=>{e.preventDefault();const submit=e.submitter;submit.disabled=true;try{const {value,errors}=Model.validateMember(Object.fromEntries(new FormData(e.target)));if(data.members.some(m=>m.id!==member?.id&&m.email.toLowerCase()===value.email))errors.push('Email này đã có trong danh sách.');let photo=member?.photo||'';const file=$('#photo').files[0];if(file){if(file.size>500*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))errors.push('Ảnh phải là PNG, JPG hoặc WebP và không quá 500 KB.');else photo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Không đọc được ảnh.'));reader.readAsDataURL(file);});}if(errors.length){$('#form-error').textContent=errors.join('. ');return;}const item={...value,id:member?.id||uid(),photo};const next={...data,members:member?data.members.map(m=>m.id===member.id?item:m):[...data.members,item]};if(persist(next)){dialog.close();render();toast('Đã lưu hồ sơ trên trình duyệt.');}}catch(err){$('#form-error').textContent=err.message;}finally{submit.disabled=false;}};
}
function hasExcel(){if(!window.XLSX){toast('Chưa tải được thư viện Excel. Cô kiểm tra mạng rồi tải lại trang.');return false;}return true;}
function downloadTemplate(){if(!hasExcel())return;const sheet=XLSX.utils.aoa_to_sheet([Model.headers]);sheet['!cols']=[{wch:28},{wch:32},{wch:20},{wch:18},{wch:16}];const help=XLSX.utils.aoa_to_sheet([['HƯỚNG DẪN NHẬP THÀNH VIÊN'],['Nhập dữ liệu tại trang Thành viên, giữ nguyên hàng tiêu đề.'],['Họ và tên, Email và Chức danh là bắt buộc.'],['Chức danh: Tổ trưởng, Tổ phó hoặc Tổ viên.'],['Định dạng cột Số điện thoại là Văn bản để giữ số 0 đầu.'],['Mỗi dòng là một giáo viên. Tối đa 500 dòng, file 5 MB.'],['Dùng dữ liệu thử trong bản giao diện này.']]);help['!cols']=[{wch:85}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'Thành viên');XLSX.utils.book_append_sheet(wb,help,'Hướng dẫn');XLSX.writeFile(wb,'Mau_thanh_vien_To_4.xlsx');}
function importDialog(){
 pendingRows=[];
 openDialog('Nhập danh sách từ Excel','<p class="small muted">Cô tải mẫu, điền danh sách rồi kéo thả file vào bên dưới. Có thể sửa trực tiếp ở bảng xem trước.</p><button class="btn" id="download-template">'+icon('download')+'Tải file Excel mẫu</button><div class="dropzone" id="dropzone">'+icon('upload')+'<strong>Kéo thả file Excel vào đây</strong><p>Định dạng .xlsx, .xls · Tối đa 5 MB / 500 dòng</p><label class="btn" for="excel-file">Chọn file từ máy tính</label><input id="excel-file" type="file" accept=".xlsx,.xls" style="display:block;margin:12px auto 0;max-width:100%" aria-label="Chọn file Excel"></div><div id="import-error" class="error" role="alert"></div><div id="preview"></div><div class="dialog-actions"><button class="btn" data-close>Đóng</button><button class="btn primary" id="confirm-import" disabled>Nhập danh sách</button></div>',true);
 $('#download-template').onclick=downloadTemplate;
 const drop=$('#dropzone');
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover');};drop.ondragleave=()=>drop.classList.remove('dragover');
 drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');if(e.dataTransfer.files.length!==1){$('#import-error').textContent='Vui lòng chọn một file mỗi lần.';return;}readExcel(e.dataTransfer.files[0]);};
 $('#excel-file').onchange=e=>readExcel(e.target.files[0]);
 $('#confirm-import').onclick=()=>{
  try{const result=Model.mergeImport(data.members,pendingRows,$('#duplicate-mode').value,uid);if(persist({...data,members:result.members})){dialog.close();navigate('members');toast('Đã thêm '+result.added+', cập nhật '+result.updated+', bỏ qua '+result.skipped+' hồ sơ.');}}catch(err){$('#import-error').textContent=err.message;}
 };
}
let importGeneration=0;
async function readExcel(file){
 const generation=++importGeneration;
 if(!file)return;
 pendingRows=[];$('#confirm-import').disabled=true;$('#preview').innerHTML='';$('#import-error').textContent='';
 if(!hasExcel())return;
 try{
  if(!/\.(xlsx|xls)$/i.test(file.name)||file.size>5*1024*1024)throw Error('Cần file .xlsx hoặc .xls không quá 5 MB.');
  const bytes=await file.arrayBuffer();
  if(generation!==importGeneration||!dialog.open)return;
  const wb=XLSX.read(bytes,{type:'array',sheetRows:502});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const fullRef=sheet['!fullref']||sheet['!ref'];
  if(fullRef&&XLSX.utils.decode_range(fullRef).e.r>=501)throw Error('Mỗi lần nhập tối đa 500 dòng. Vui lòng chia nhỏ file.');
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:true});
  pendingRows=Model.previewImport(matrix,data.members);
  if(!pendingRows.length)throw Error('File mới có tiêu đề, chưa có thành viên.');
  renderImportPreview();
 }catch(err){$('#import-error').textContent=err.message||'Không đọc được file Excel.';}
}
function renderImportPreview(){
 $('#preview').innerHTML='<div class="toolbar"><strong class="small">'+pendingRows.length+' dòng · <span id="error-count"></span></strong><label class="small">Email đã có: <select id="duplicate-mode"><option value="skip">Bỏ qua</option><option value="update">Cập nhật hồ sơ</option></select></label></div><div class="table-wrap"><table><thead><tr><th>DÒNG</th>'+Model.headers.map(h=>'<th>'+h+'</th>').join('')+'<th>KIỂM TRA</th></tr></thead><tbody>'+pendingRows.map((r,i)=>'<tr data-row="'+i+'"><td>'+r.line+'</td>'+['name','email','phone','role','className'].map((k,n)=>'<td class="preview-cell">'+(k==='role'?'<select data-key="role" aria-label="Chức danh dòng '+r.line+'">'+(!Model.roles.includes(r.value.role)?'<option value="'+esc(r.value.role)+'">'+esc(r.value.role||'Chọn chức danh')+'</option>':'')+Model.roles.map(role=>'<option'+(role===r.value.role?' selected':'')+'>'+role+'</option>').join('')+'</select>':'<input data-key="'+k+'" aria-label="'+Model.headers[n]+' dòng '+r.line+'" value="'+esc(r.value[k])+'">')+'</td>').join('')+'<td class="row-status small"></td></tr>').join('')+'</tbody></table></div>';
 $('#preview').oninput=e=>{const input=e.target.closest('[data-key]');if(!input)return;pendingRows[Number(input.closest('tr').dataset.row)].value[input.dataset.key]=input.value;validatePreview();};
 $('#preview').onchange=$('#preview').oninput;validatePreview();
}
function validatePreview(){
 const seen=new Set();
 pendingRows.forEach((r,i)=>{
  const checked=Model.validateMember(r.value);r.value=checked.value;r.errors=checked.errors;
  if(seen.has(r.value.email))r.errors.push('Email trùng trong file');seen.add(r.value.email);
  r.duplicate=data.members.some(m=>m.email.toLowerCase()===r.value.email);
  const el=$('[data-row="'+i+'"] .row-status',dialog);el.textContent=r.errors.length?r.errors.join('; '):r.duplicate?'Email đã có':'Hợp lệ';el.style.color=r.errors.length?'#a34539':'#618468';
 });
 const errors=pendingRows.filter(r=>r.errors.length).length;
 $('#error-count').textContent=errors+' dòng cần sửa';$('#confirm-import').disabled=!!errors||!pendingRows.length;
}
function meetingDialog(event){
 openDialog(event?'Chỉnh sửa lịch họp':'Tạo lịch họp','<form id="meeting-form"><div class="fields">'+field('Tên hoạt động *','title',event?.title||'','text',true)+field('Thời gian *','when',event?.when||'','datetime-local',true)+field('Địa điểm *','place',event?.place||'Phòng họp chuyên môn','text',true)+'<label class="field full">Nội dung<textarea name="description" rows="3" maxlength="2000">'+esc(event?.description||'')+'</textarea></label></div><p class="small muted">Thời gian theo giờ trên thiết bị. Bản xem thử chưa gửi email hoặc tin nhắn.</p>'+formActions('Lưu lịch họp')+'</form>');
 $('#meeting-form').onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));if(!values.title.trim()||!values.place.trim()||!Number.isFinite(new Date(values.when).getTime())){$('#form-error').textContent='Vui lòng nhập tên, địa điểm và thời gian hợp lệ.';return;}const item={...values,title:values.title.trim(),place:values.place.trim(),id:event?.id||uid(),attendance:event?.attendance||{}};if(persist({...data,events:event?data.events.map(x=>x.id===event.id?item:x):[...data.events,item]})){dialog.close();render();toast('Đã lưu lịch họp. Chưa gửi thông báo.');}};
}
function attendanceDialog(event){
 openDialog('Điểm danh: '+esc(event.title),'<form id="attendance-form"><p class="small muted">Đánh dấu các thành viên có mặt. Chưa quy đổi thành điểm thi đua.</p>'+(data.members.length?data.members.map(m=>'<label class="check"><input type="checkbox" name="'+esc(m.id)+'" '+(event.attendance?.[m.id]?'checked':'')+'>'+avatar(m)+'<span>'+esc(m.name)+'</span><small>'+esc(m.className)+'</small></label>').join(''):empty('Chưa có thành viên','Cô thêm hoặc nhập danh sách thành viên trước khi điểm danh.'))+formActions('Lưu điểm danh')+'</form>');
 $('#attendance-form').onsubmit=e=>{e.preventDefault();const selected=new FormData(e.target);const attendance=Object.fromEntries(data.members.map(m=>[m.id,selected.has(m.id)]));if(persist({...data,events:data.events.map(x=>x.id===event.id?{...x,attendance}:x)})){dialog.close();render();toast('Đã lưu điểm danh trên trình duyệt.');}};
}
function noteDialog(note){
 openDialog(note?'Chỉnh sửa ghi chú':'Ghi lại một ý tưởng','<form id="note-form"><div class="fields">'+field('Tiêu đề *','title',note?.title||'','text',true)+'<label class="field full">Nội dung *<textarea name="body" rows="7" maxlength="10000" required>'+esc(note?.body||'')+'</textarea></label></div>'+formActions('Lưu ghi chú')+'</form>');
 $('#note-form').onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));if(!values.title.trim()||!values.body.trim()){$('#form-error').textContent='Tiêu đề và nội dung không được để trống.';return;}const item={...values,id:note?.id||uid()};if(persist({...data,notes:note?data.notes.map(n=>n.id===note.id?item:n):[item,...data.notes]})){dialog.close();render();toast('Đã lưu ghi chú trên trình duyệt.');}};
}
function seed(){
 if(data.members.length||data.events.length){toast('Chỉ thêm minh họa khi danh sách và lịch đều trống.');return;}
 const next={...data,members:[{id:uid(),name:'Giáo viên minh họa A',email:'giaovien.a@example.com',phone:'',role:'Tổ trưởng',className:'4/1',photo:''},{id:uid(),name:'Giáo viên minh họa B',email:'giaovien.b@example.com',phone:'',role:'Tổ phó',className:'4/2',photo:''},{id:uid(),name:'Giáo viên minh họa C',email:'giaovien.c@example.com',phone:'',role:'Tổ viên',className:'4/3',photo:''}],events:[]};
 const date=new Date();date.setDate(date.getDate()+2);const when=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')+'T14:00';
 next.events.push({id:uid(),title:'Minh họa: Sinh hoạt chuyên môn',when,place:'Phòng họp chuyên môn',description:'Trao đổi kế hoạch bài dạy và chia sẻ học liệu.',attendance:{}});
 if(persist(next)){navigate('overview');toast('Đã thêm dữ liệu minh họa, không phải hồ sơ giáo viên thật.');}
}
function resetData(){
 openDialog('Xóa dữ liệu thử?','<p>Thao tác này xóa danh sách, lịch và ghi chú của bản xem thử trên trình duyệt này. Không ảnh hưởng dữ liệu trên Drive.</p><div class="dialog-actions"><button class="btn" data-close>Giữ lại</button><button class="btn danger" id="confirm-reset">Xóa dữ liệu thử</button></div>');
 $('#confirm-reset').onclick=()=>{if(persist({members:[],events:[],notes:[]})){dialog.close();render();toast('Đã xóa dữ liệu thử.');}};
}
$('#about-preview').onclick=()=>openDialog('Bản xem thử · Trường học 5.0','<p>Cô có thể thử quản lý thành viên, nhập Excel, lập lịch, điểm danh và ghi chú cá nhân.</p><p class="small muted">Dữ liệu lưu trong trình duyệt hiện tại. Chưa có đăng nhập, phân quyền, duyệt tài khoản, đồng bộ Drive, Gemini hoặc gửi thông báo. Các module còn lại đang ở bước phác thảo giao diện.</p><div class="dialog-actions"><button class="btn primary" data-close>Đã hiểu</button></div>');
render();

function updateClock(){ const now=new Date(); const zone={timeZone:"Asia/Ho_Chi_Minh"}; const clock=document.getElementById("live-time"); clock.textContent=new Intl.DateTimeFormat("vi-VN",{...zone,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now); clock.dateTime=now.toISOString(); document.getElementById("live-date").textContent=new Intl.DateTimeFormat("vi-VN",{...zone,weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"}).format(now); }
updateClock(); setInterval(updateClock,1000);
