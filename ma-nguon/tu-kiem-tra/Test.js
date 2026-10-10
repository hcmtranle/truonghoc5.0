// TẠM THỜI: tự kiểm tra lớp nhiều đơn vị (bản không mật khẩu, không thư mục) trên máy chủ thật. Sẽ gỡ ngay sau khi thử.
const TH50_TEST_KEY='KHOA_TU_KIEM_TRA';
function ktGoc_(){
  dvRa_();const db=db_(),dem=(n,f)=>read_(db,n).filter(f).length,out={};
  out.teams=read_(db,'Teams').map(t=>({id:t.id,name:t.name,active:String(t.active),createdAt:t.createdAt,createdBy:t.createdBy,
    thanhVien:dem('Memberships',m=>m.teamId===t.id&&m.status!=='REMOVED'),thanhVienDaXoa:dem('Memberships',m=>m.teamId===t.id&&m.status==='REMOVED'),nguoiDung:dem('Users',u=>u.teamId===t.id),lichHop:dem('Meetings',m=>m.teamId===t.id),bienBan:dem('Minutes',m=>m.teamId===t.id),phanCong:dem('Assignments',m=>m.teamId===t.id)}));
  out.nguoiDungKhongTo=dem('Users',u=>!u.teamId);out.emailConLai=hanMucEmail_();
  out.trigger=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction()+':'+t.getEventType());
  return out;
}
function selfTest_(q){
  if(q.goc==='1')return ktGoc_();
  // Việc làm thật trên đơn vị gốc (không dùng tiền tố thử): tạo Sheet mẫu thật; xóa tổ trùng tên còn trống.
  if(q.viec==='mau'){DV_PREFIX='';const id=dvTaoSheetMau_();return {sheetMau:id,link:getThongTinDangKy().linkMau,ten:DriveApp.getFileById(id).getName(),chiaSe:String(DriveApp.getFileById(id).getSharingAccess())};}
  if(q.viec==='xoato'){
    dvRa_();const db=db_(),sh=db.getSheetByName('Teams'),v=sh.getDataRange().getValues(),h=v[0],iId=h.indexOf('id'),iTen=h.indexOf('name'),ID='f0aaee3f-e80b-4b6c-b2d7-90986ad86a03';
    const dung=n=>read_(db,n).filter(x=>x.teamId===ID).length,con={Memberships:dung('Memberships'),Meetings:dung('Meetings'),Minutes:dung('Minutes'),Users:dung('Users'),Assignments:dung('Assignments')};
    if(Object.keys(con).some(k=>con[k]>0))return {daXoa:false,lyDo:'tổ này đã có dữ liệu',con:con};
    for(let i=1;i<v.length;i++)if(String(v[i][iId])===ID){const ten=v[i][iTen];sh.deleteRow(i+1);return {daXoa:true,ten:ten,dong:i+1,conLai:read_(db,'Teams').map(t=>t.id+':'+t.name)};}
    return {daXoa:false,lyDo:'không còn dòng này',conLai:read_(db,'Teams').map(t=>t.id+':'+t.name)};
  }
  const out={ok:[],loi:[]},MA='thu-to-4';
  const buoc=(ten,f)=>{try{const r=f();out.ok.push(ten+(r===undefined?'':' → '+String(r).slice(0,170)))}catch(e){out.loi.push(ten+' :: '+e.message+' | '+String(e.stack).split('\n').slice(1,3).join(' '))}};
  const mong=(dk,ghi)=>{if(!dk)throw new Error('SAI: '+ghi);return ghi};
  const loiMong=(f,chua)=>{try{f()}catch(e){if(chua&&e.message.indexOf(chua)<0)throw new Error('lỗi khác mong đợi: '+e.message);return 'đã chặn: '+e.message.slice(0,80)}throw new Error('đáng lẽ phải bị chặn')};
  const props=PropertiesService.getScriptProperties(),he=dvHeThong_(),gv=he.replace('@','+gvthu@'),gv2=he.replace('@','+gvhai@');
  const demGoc=()=>{dvRa_();const db=db_();return ['Users','Notebooks','Minutes','Meetings','Memberships','LoginCodes'].map(n=>{const sh=db.getSheetByName(n);return n+':'+(sh?sh.getLastRow():0)}).join(',')};
  const trongDonVi=f=>{dvRa_();if(!dvVao_(MA,true))throw new Error('không vào được đơn vị thử');try{return f(db_())}finally{dvRa_()}};
  const maDangNhap=(email)=>trongDonVi(db=>{append_(db,'LoginCodes',{id:Utilities.getUuid(),email:email,codeHash:digest_('246810'),expiresAt:Date.now()+600000,used:false,createdAt:now_()});return '246810'});
  let truoc='',mauId='',ss=null,qt='',tkAdmin='',tkGv='',soHop=null,emailDau=hanMucEmail_();
  buoc('hạn mức email còn lại hôm nay (trước khi thử)',()=>emailDau);
  buoc('quyền Google Lịch của tài khoản hệ thống (chỉ đọc)',()=>{try{return capQuyenLichGoogle()}catch(e){return 'CHƯA CẤP: '+String(e.message).slice(0,90)}});
  buoc('đếm dữ liệu đơn vị gốc trước khi thử',()=>{truoc=demGoc();return truoc});
  buoc('tạo Sheet mẫu (bản thử) công khai xem bằng link',()=>{mauId=dvTaoSheetMau_();const f=DriveApp.getFileById(mauId);mong(f.getSharingAccess()===DriveApp.Access.ANYONE_WITH_LINK&&/\/copy$/.test(getThongTinDangKy().linkMau),'ai có link đều xem được, có link tạo bản sao');return f.getName()});
  buoc('tạo bản sao Sheet mẫu cho đơn vị thử',()=>{const f=DriveApp.getFileById(mauId).makeCopy('[THỬ MÁY] dữ liệu đơn vị thử');ss=SpreadsheetApp.openById(f.getId());return 'ok'});
  buoc('đăng ký bằng Sheet thuộc tài khoản hệ thống bị từ chối',()=>{const r=dangKyDonVi({dongY:true,loai:'TO',linkSheet:ss.getUrl(),coQuan:'Ủy ban nhân dân phường thử',tenTruong:'Trường Tiểu học Thử Nghiệm',tenTo:'Tổ chuyên môn 4',hoTen:'Người Thử',email:he,maDonVi:MA});return mong(r.success===false&&/tài khoản hệ thống/.test(r.message),r.message)});
  buoc('đăng ký thiếu đồng ý điều khoản bị từ chối',()=>{const r=dangKyDonVi({dongY:false});return mong(r.success===false,r.message)});
  buoc('ghi thẳng một đăng ký "Chờ xác nhận email" (bỏ qua kiểm tra chủ sở hữu)',()=>{dvSo_(true).getSheetByName('DonVi').appendRow([MA,new Date(),'TO','TRƯỜNG TIỂU HỌC THỬ NGHIỆM','Tổ chuyên môn 4','ỦY BAN NHÂN DÂN PHƯỜNG THỬ','Người Thử',he,ss.getId(),'','Chờ xác nhận email','',Date.now()+600000,dvBam_(MA,'135790')]);return dvDong_().length+' dòng trong sổ'});
  buoc('Admin dự án: đặt mật khẩu qua thuộc tính rồi đăng nhập',()=>{props.setProperty(dvKey_('MAT_KHAU_QUAN_TRI'),'quan-tri-thu-123');const r=dangNhapQuanTri('quan-tri-thu-123');qt=r.token;return mong(r.success,'ok')});
  buoc('chưa xác nhận email thì Admin dự án chưa duyệt được',()=>{const r=capNhatDonVi(qt,MA,'Đang hoạt động');return mong(r.success===false,r.message)});
  buoc('xác nhận email: mã sai bị từ chối, mã đúng → Chờ duyệt',()=>{const a=xacNhanDangKy(MA,'000000');mong(a.success===false,'mã sai');const b=xacNhanDangKy(MA,'135790');mong(b.success,'mã đúng');return dvDong_().find(x=>x.MaDonVi===MA).TrangThai});
  buoc('đơn vị chờ duyệt chưa gọi được',()=>loiMong(()=>goi(MA,'listPublicTeams',[]),'chưa được kích hoạt'));
  buoc('Admin dự án: duyệt đơn vị thử (gửi 1 email báo kích hoạt)',()=>{const r=capNhatDonVi(qt,MA,'Đang hoạt động');return mong(r.success===true,JSON.stringify(r))});
  buoc('đơn vị: email chưa có tài khoản không nhận được mã đăng nhập',()=>loiMong(()=>goi(MA,'requestAccessCode',['nguoi.la@example.com']),'chưa được'));
  buoc('đơn vị: quản trị xin mã đăng nhập (gửi 1 email thật)',()=>{const r=goi(MA,'requestAccessCode',[he]);return mong(r.sent,r.message)});
  buoc('đơn vị: quản trị đăng nhập bằng mã',()=>{const code=maDangNhap(he);loiMong(()=>goi(MA,'verifyLogin',[{email:he,code:'999999'}]),'không đúng');const r=goi(MA,'verifyLogin',[{email:he,code:code}]);tkAdmin=r.token;return mong(r.user.role==='ADMIN','vai trò '+r.user.role)});
  buoc('đơn vị: bootstrap',()=>{const s=goi(MA,'bootstrap',[tkAdmin]);return mong(s.org.school==='TRƯỜNG TIỂU HỌC THỬ NGHIỆM'&&s.teams.length===1&&s.teams[0].name==='Tổ chuyên môn 4'&&s.teamMembers.length===1,'trường='+s.org.school+' tổ='+s.teams.map(t=>t.name)+' thành viên='+s.teamMembers.length)});
  buoc('đơn vị theo tổ: không tạo thêm tổ được; hàm ngoài danh sách bị chặn',()=>loiMong(()=>goi(MA,'saveTeam',[tkAdmin,{name:'Tổ khác'}]),'chỉ có một tổ')+' | '+loiMong(()=>goi(MA,'adminLogin',['x']),'chưa mở'));
  buoc('đơn vị: giáo viên tự đăng ký → chờ duyệt, CHƯA kích hoạt và CHƯA đăng nhập được',()=>{const a=goi(MA,'registerUser',[{name:'Giáo Viên Hai',email:gv2,phone:'0901234567',teamId:'to-4',requestedRole:'TEACHER'}]);mong(a.status==='PENDING','chờ duyệt');const x=loiMong(()=>goi(MA,'activateAccount',[{email:gv2,code:'123456'}]),'không đúng');return x+' | '+loiMong(()=>goi(MA,'requestAccessCode',[gv2]),'chưa được')});
  buoc('đơn vị: quản trị duyệt (gửi mã kích hoạt qua email) → giáo viên kích hoạt → đăng nhập',()=>{const ds=goi(MA,'adminApprovals',[tkAdmin]).items;mong(ds.length===1&&!('activationHash' in ds[0]),'danh sách chờ không lộ mã băm');mong(goi(MA,'approveRegistration',[tkAdmin,gv2,'TEACHER'])===true,'đã duyệt');trongDonVi(db=>updateWhere_(db,'Users',r=>r.email===gv2,r=>Object.assign(r,{activationHash:digest_('112233')})));loiMong(()=>goi(MA,'activateAccount',[{email:gv2,code:'000000'}]),'không đúng');mong(goi(MA,'activateAccount',[{email:gv2,code:'112233'}]).activated,'kích hoạt');const l=goi(MA,'verifyLogin',[{email:gv2,code:maDangNhap(gv2)}]);return mong(!!l.token&&l.user.role==='TEACHER','đăng nhập được')});
  buoc('đơn vị: tổ trưởng thêm giáo viên (gửi thư mời qua email) → kích hoạt → đăng nhập',()=>{const r=goi(MA,'addTeamMember',[tkAdmin,{name:'Giáo Viên Thử',email:gv,phone:'',role:'TEACHER',className:'4/1',teamId:'to-4'}]);mong(r.invited&&!r.code,'không trả mã về trình duyệt');trongDonVi(db=>updateWhere_(db,'Users',x=>x.email===gv,x=>Object.assign(x,{activationHash:digest_('445566')})));mong(goi(MA,'activateAccount',[{email:gv,code:'445566'}]).activated,'kích hoạt');const l=goi(MA,'verifyLogin',[{email:gv,code:maDangNhap(gv)}]);tkGv=l.token;return mong(l.user.role==='TEACHER','vai trò '+l.user.role)});
  buoc('đơn vị: giáo viên không gọi được việc của quản trị',()=>loiMong(()=>goi(MA,'adminUsers',[tkGv]),'không có quyền'));
  buoc('đơn vị: lưu sổ họp → tệp tạm trong Drive hệ thống, xem được bằng link, hạn 30 ngày',()=>{soHop=goi(MA,'saveNotebook',[tkGv,{title:'Sổ họp thử',chair:'Người Thử',creator:'Giáo Viên Thử',attendees:'Cả tổ',content:'Dòng 1.\nDòng 2.'}]);const f=DriveApp.getFileById(soHop.docId),cha=f.getParents().next(),ong=cha.getParents().next(),ngay=Math.round((new Date(soHop.expiresAt).getTime()-Date.now())/86400000);return mong(ong.getName()===MA&&f.getSharingAccess()===DriveApp.Access.ANYONE_WITH_LINK&&ngay>=29&&ngay<=30,'thư mục: '+ong.getParents().next().getName()+' / '+ong.getName()+' / '+cha.getName()+'; còn '+ngay+' ngày')});
  buoc('đơn vị: hết hạn thì tệp bị xóa nhưng nội dung còn trong Sheet; tạo lại tệp được',()=>{const cu=soHop.docId;trongDonVi(db=>{updateWhere_(db,'Notebooks',r=>r.id===soHop.id,r=>Object.assign(r,{expiresAt:'2020-01-01T00:00:00'}));cleanupCore_()});mong(DriveApp.getFileById(cu).isTrashed(),'tệp cũ đã vào thùng rác');const s=goi(MA,'bootstrap',[tkGv]),n=s.notebooks.find(x=>x.id===soHop.id);mong(n&&!n.docUrl&&n.content==='Dòng 1.\nDòng 2.','sổ họp còn trong danh sách, nội dung còn nguyên');const r=goi(MA,'taoLaiTep',[tkGv,'notebook',soHop.id]);const n2=goi(MA,'bootstrap',[tkGv]).notebooks.find(x=>x.id===soHop.id);return mong(!!r.docUrl&&n2.docId&&n2.docId!==cu,'đã tạo lại tệp mới')});
  buoc('đơn vị: lưu biên bản có danh sách thành viên; xuất PDF xem được bằng link',()=>{const n=goi(MA,'saveMeetingMinutes',[tkAdmin,{title:'Biên bản thử',chair:'Người Thử',secretary:'Giáo Viên Thử',agenda:'Nội dung',discussion:'Thảo luận',conclusion:'Kết luận',memberSigns:[{email:gv,name:'Giáo Viên Thử',absent:false},{email:gv2,name:'Giáo Viên Hai',absent:true,note:'Ốm'}]}]);const p=goi(MA,'exportMeetingMinutesPdf',[tkAdmin,n.id]);out.bienBan=n.docUrl;return mong(n.teamId==='to-4'&&DriveApp.getFileById(fileIdFromUrl_(p.pdfUrl)).getSharingAccess()===DriveApp.Access.ANYONE_WITH_LINK,'tổ '+n.teamId+', PDF mở được bằng link')});
  buoc('đơn vị: lịch họp trực tuyến dán link, không ghi Calendar, không gửi email; điểm danh; xóa lịch',()=>{const d=new Date(Date.now()+86400000);const m=goi(MA,'createMeeting',[tkAdmin,{title:'Họp thử',startAt:d.toISOString(),mode:'ONLINE',onlineTool:'MEET',customUrl:'https://meet.google.com/abc-defg-hij',attendeeEmails:[gv,he]}]);mong(m.calendarEventId===''&&m.meetUrl==='https://meet.google.com/abc-defg-hij'&&m.mailed===false,'không có sự kiện Calendar');goi(MA,'respondAttendance',[tkGv,m.id,'ABSENT','Đi tập huấn']);goi(MA,'setAttendance',[tkAdmin,m.id,[{email:gv,status:'PRESENT',note:''}]]);goi(MA,'deleteMeeting',[tkAdmin,m.id]);return 'ok'});
  // ---------- 05/10/2026: trường đăng ký có nhiều tổ ----------
  const MA2='thu-truong',MA3='thu-truong-cu';let ss2=null,ss3=null,tk2='',ds2=[];
  const vaoDv=(ma,f)=>{dvRa_();if(!dvVao_(ma,true))throw new Error('không vào được '+ma);try{return f(db_())}finally{dvRa_()}};
  const toGoc0=(()=>{dvRa_();return read_(db_(),'Teams').map(t=>t.id+':'+t.name).join('|')})();
  buoc('trường: kiểm tra danh sách tổ khi đăng ký (bỏ trùng, bắt buộc ít nhất 1 tổ)',()=>{ss2=SpreadsheetApp.openById(DriveApp.getFileById(mauId).makeCopy('[THỬ MÁY] trường nhiều tổ').getId());
    const o=dvKiemTraDauVao_({loai:'TRUONG',tenTruong:'Trường Tiểu học Thử Hai',hoTen:'Người Thử',email:he,maDonVi:MA2,linkSheet:ss2.getUrl(),dsTo:['Tổ 1–2','Tổ 3',' tổ  3 ','Tổ Tiếng Anh – Tin học']});
    const rong=dvKiemTraDauVao_({loai:'TRUONG',tenTruong:'Trường Tiểu học Thử Hai',hoTen:'Người Thử',email:he,maDonVi:MA2,linkSheet:ss2.getUrl(),dsTo:[]});
    const md=dvKiemTraDauVao_({loai:'TRUONG',tenTruong:'Trường Tiểu học Thử Hai',hoTen:'Người Thử',email:he,maDonVi:MA2,linkSheet:ss2.getUrl()});
    ds2=o.dsTo;mong(ds2.length===3&&typeof rong==='string'&&md.dsTo.length===7,JSON.stringify([ds2,rong,md.dsTo]));return ds2.join(', ')});
  buoc('trường: duyệt đơn vị → tạo đúng các tổ đã chọn, không có "Tổ chuyên môn 1"',()=>{dvSo_(true).getSheetByName('DonVi').appendRow([MA2,new Date(),'TRUONG','TRƯỜNG TIỂU HỌC THỬ HAI','','ỦY BAN NHÂN DÂN PHƯỜNG THỬ','Người Thử',he,ss2.getId(),JSON.stringify(ds2),'Chờ duyệt','','','']);dvXoaNho_(MA2);
    const r=capNhatDonVi(qt,MA2,'Đang hoạt động');mong(r.success,JSON.stringify(r));
    const t=goi(MA2,'listPublicTeams',[]).items.map(x=>x.name);return mong(t.join('|')===ds2.join('|'),t.join('|'))});
  buoc('trường: quản trị đăng nhập; tổ đang xem là tổ đầu tiên; quản trị không bị gán tổ',()=>{vaoDv(MA2,db=>append_(db,'LoginCodes',{id:Utilities.getUuid(),email:he,codeHash:digest_('246810'),expiresAt:Date.now()+600000,used:false,createdAt:now_()}));
    const r=goi(MA2,'verifyLogin',[{email:he,code:'246810'}]);tk2=r.token;const s=goi(MA2,'bootstrap',[tk2]);
    const u=vaoDv(MA2,db=>read_(db,'Users').find(x=>x.email===he));
    return mong(r.user.role==='ADMIN'&&s.teams.length===3&&s.activeTeamId===s.teams[0].id&&!u.teamId,'tổ đang xem='+s.activeTeamId+' teamId='+u.teamId)});
  buoc('trường: giáo viên đăng ký phải chọn tổ; chọn Tổ 3 → chờ duyệt',()=>{const a=loiMong(()=>goi(MA2,'registerUser',[{name:'Giáo Viên Ba',email:he.replace('@','+gvba@'),phone:'0901234568',requestedRole:'TEACHER'}]),'chọn tổ');
    const to3=goi(MA2,'listPublicTeams',[]).items.find(x=>x.name==='Tổ 3').id;const b=goi(MA2,'registerUser',[{name:'Giáo Viên Ba',email:he.replace('@','+gvba@'),phone:'0901234568',teamId:to3,requestedRole:'TEACHER'}]);return a+' | '+mong(b.status==='PENDING','chờ duyệt')});
  buoc('trường: Admin thấy tổ đã chọn và đổi sang Tổ 1–2 khi duyệt (gửi 1 email)',()=>{const r=goi(MA2,'adminApprovals',[tk2]),x=r.items.find(i=>i.email===he.replace('@','+gvba@')),t12=r.teams.find(t=>t.name==='Tổ 1–2').id;
    mong(r.teams.length===3&&x&&r.teams.find(t=>t.id===x.teamId).name==='Tổ 3','thấy Tổ 3');goi(MA2,'approveRegistration',[tk2,x.email,'LEADER',t12]);
    const m=vaoDv(MA2,db=>read_(db,'Memberships').filter(z=>z.userEmail===x.email));return mong(m.length===1&&m[0].teamId===t12&&m[0].role==='LEADER','vào Tổ 1–2 với vai trò tổ trưởng')});
  buoc('trường: Admin chuyển giáo viên sang Tổ Tiếng Anh – Tin học',()=>{const e=he.replace('@','+gvba@'),ta=goi(MA2,'listPublicTeams',[]).items.find(x=>x.name==='Tổ Tiếng Anh – Tin học').id;const r=goi(MA2,'chuyenTo',[tk2,e,ta]);
    const m=vaoDv(MA2,db=>read_(db,'Memberships').filter(z=>z.userEmail===e)),u=vaoDv(MA2,db=>read_(db,'Users').find(z=>z.email===e));
    return mong(r.moved&&m.filter(z=>z.status!=='REMOVED').length===1&&m.find(z=>z.status!=='REMOVED').teamId===ta&&u.teamId===ta,JSON.stringify(m.map(z=>z.teamId.slice(0,6)+':'+z.status)))});
  buoc('trường: giáo viên không chuyển tổ được; Admin sửa tên, ẩn tổ',()=>{const a=loiMong(()=>goi(MA2,'chuyenTo',['sai','x','y']));const t=goi(MA2,'listPublicTeams',[]).items,t3=t.find(x=>x.name==='Tổ 3');
    goi(MA2,'saveTeam',[tk2,{id:t3.id,name:'Tổ 3 (đổi tên)',active:false}]);const sau=goi(MA2,'listPublicTeams',[]).items.map(x=>x.name);return a+' | '+mong(sau.length===2&&sau.indexOf('Tổ 3 (đổi tên)')<0,sau.join('|'))});
  buoc('10/10 trường: họp liên tịch (tổ trưởng + BGH), quản trị thấy lịch + số liệu trường',()=>{const d=new Date(Date.now()+2*864e5);const r=goi(MA2,'createMeeting',[tk2,{loaiHop:'LIEN_TICH',title:'Họp liên tịch thử',startAt:d.toISOString(),mode:'OFFLINE',location:'Phòng họp'}]);
    const s=goi(MA2,'bootstrap',[tk2]),m=s.meetings.find(x=>x.id===r.id);const tv=vaoDv(MA2,db=>thanhPhanHop_(db,'LIEN_TICH').map(x=>x.vaiTro).join(','));
    return mong(r.teamId==='truong'&&r.loaiHop==='LIEN_TICH'&&m&&s.truong&&s.truong.soTo===2,'mời '+r.soMoi+' ('+tv+'), báo email '+r.baoTo+', số tổ '+(s.truong&&s.truong.soTo))});
  buoc('10/10 trường: họp hội đồng toàn trường mời mọi tài khoản; tổ trưởng không xóa được lịch của trường',()=>{const d=new Date(Date.now()+3*864e5);const r=goi(MA2,'createMeeting',[tk2,{loaiHop:'HOI_DONG_TOAN_TRUONG',title:'Họp hội đồng thử',startAt:d.toISOString(),mode:'OFFLINE'}]);
    const so=vaoDv(MA2,db=>read_(db,'Users').filter(u=>u.status!=='DISABLED'&&u.status!=='PENDING').length);return mong(r.soMoi===so&&r.baoTo===0,'mời '+r.soMoi+'/'+so)});
  buoc('10/10 trường: thi đua giữa các tổ (tự tính + cộng/trừ có lý do, xóa)',()=>{const a=goi(MA2,'thiDuaCacTo',[tk2,'nam-hoc']),t=a.rows[0].teamId;loiMong(()=>goi(MA2,'ghiDiemThiDuaTo',[tk2,{teamId:t,diem:5,lyDo:''}]),'lý do');
    const g=goi(MA2,'ghiDiemThiDuaTo',[tk2,{teamId:t,diem:5,lyDo:'Chuyên đề cấp trường',ky:'nam-hoc'}]),b=goi(MA2,'thiDuaCacTo',[tk2,'nam-hoc']),x=b.rows.find(z=>z.teamId===t);goi(MA2,'xoaDiemThiDuaTo',[tk2,g.id]);const c=goi(MA2,'thiDuaCacTo',[tk2,'nam-hoc']).rows.find(z=>z.teamId===t);
    return mong(x.diemThem===5&&x.tong===x.diemTuDong+5&&c.diemThem===0&&b.rows.length===a.rows.length,a.rows.map(z=>z.ten+':'+z.tong).join(', '))});
  buoc('10/10 trường: thư mục lưu trữ của đơn vị (link/ID của đơn vị, sai thì báo)',()=>{const a=loiMong(()=>goi(MA2,'luuThuMucDonVi',[tk2,'abc']),'Chưa đúng');goi(MA2,'luuThuMucDonVi',[tk2,'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345']);
    const l=goi(MA2,'bootstrap',[tk2]).systemLinks;goi(MA2,'luuThuMucDonVi',[tk2,'']);return a+' | '+mong(l.donVi&&l.thuMucId==='1AbCdEfGhIjKlMnOpQrStUvWxYz012345'&&!l.github&&!l.drive,JSON.stringify(l).slice(0,90))});
  buoc('trường đã đăng ký trước đây (chỉ có "Tổ chuyên môn 1"): chỉ THÊM các tổ còn thiếu',()=>{ss3=SpreadsheetApp.openById(DriveApp.getFileById(mauId).makeCopy('[THỬ MÁY] trường cũ một tổ').getId());
    const sh=ss3.insertSheet('Teams');sh.appendRow(['id','name','schoolYear','active','createdAt','createdBy']);sh.appendRow(['to-4','Tổ chuyên môn 1','2026-2027',true,now_(),'du-an-tong']);
    dvSo_(true).getSheetByName('DonVi').appendRow([MA3,new Date(),'TRUONG','TRƯỜNG TIỂU HỌC THỬ BA','','','Người Thử',he,ss3.getId(),'','Đang hoạt động',new Date(),'','']);dvXoaNho_(MA3);
    const t=goi(MA3,'listPublicTeams',[]).items.map(x=>x.name),t2=goi(MA3,'listPublicTeams',[]).items.length;
    return mong(t.length===7&&t[0]==='Tổ chuyên môn 1'&&t.indexOf('Tổ 1')<0&&t.indexOf('Tổ Bộ môn')>0&&t2===7,t.join('|'))});
  buoc('đơn vị gốc và đơn vị theo tổ: tổ không đổi, mặc định vẫn to-4',()=>{dvRa_();const a=read_(db_(),'Teams').map(t=>t.id+':'+t.name).join('|');const b=toMacDinh_();const c=goi(MA,'listPublicTeams',[]).items.map(x=>x.name).join('|');dvRa_();return mong(a===toGoc0&&b==='to-4'&&c==='Tổ chuyên môn 4',a.length+' '+b+' '+c)});
  buoc('dọn Sheet thử của trường nhiều tổ',()=>{[ss2,ss3].forEach(x=>{if(x)DriveApp.getFileById(x.getId()).setTrashed(true)});return 'ok'});
  buoc('cách ly: phiên của đơn vị thử không dùng được ở đơn vị gốc',()=>{dvRa_();return loiMong(()=>bootstrap(tkAdmin),'hết hạn')});
  buoc('cách ly: dữ liệu đơn vị gốc không đổi',()=>{const sau=demGoc();return mong(sau===truoc,sau)});
  buoc('trang theo link',()=>{dvRa_();const a=dvTrang_({parameter:{truong:MA}}).getContent(),b=dvTrang_({parameter:{truong:'khong-co-ma-nay'}}).getContent(),c=dvTrang_({parameter:{trang:'cong-dong'}}).getContent();dvRa_();return mong(a.indexOf('window.TH50_DV="'+MA+'"')>0&&/chưa được kích hoạt/.test(b)&&b.indexOf('hcmtranle@gmail.com')>0&&/Tạo bản sao Sheet mẫu/.test(c)&&!/dkMatKhau|dkThuMuc/.test(c)&&dvTrang_({parameter:{}})===null,'trang đơn vị, trang chưa kích hoạt, trang dự án tổng (không còn ô mật khẩu, ô thư mục), link gốc không đổi')});
  buoc('Admin dự án: danh sách + số email còn lại + số liệu',()=>{const r=getDonViDangKy(qt);return 'email còn '+r.emailConLai+'; '+getSoLieuCongDong(qt).map(x=>x.ma+'['+x.nguoiDung+' người,'+x.soHop+' sổ,'+x.bienBan+' biên bản,'+(x.ok?'ok':'KHÔNG MỞ ĐƯỢC')+']').join(' ')});
  buoc('Admin dự án: tạm ngừng thì link đơn vị dừng',()=>{dvRa_();capNhatDonVi(qt,MA,'Tạm ngừng');return loiMong(()=>goi(MA,'listPublicTeams',[]),'tạm ngừng')});
  buoc('số email đã dùng cho lượt thử này',()=>emailDau-hanMucEmail_());
  if(q.giu!=='1'){
    buoc('dọn: Sheet thử, Sheet mẫu thử, sổ đăng ký thử, thư mục tạm thử, thuộc tính thử',()=>{dvRa_();const so=props.getProperty(dvKey_('SO_DANG_KY_ID'));if(ss)DriveApp.getFileById(ss.getId()).setTrashed(true);if(mauId)DriveApp.getFileById(mauId).setTrashed(true);if(so)DriveApp.getFileById(so).setTrashed(true);const it=DriveApp.getFoldersByName('[THỬ] Tệp tạm của đơn vị đăng ký');while(it.hasNext())it.next().setTrashed(true);const all=props.getProperties();let n=0;Object.keys(all).filter(k=>k.indexOf('THU_')===0).forEach(k=>{props.deleteProperty(k);n++});return 'đã xóa '+n+' thuộc tính'});
  }
  dvRa_();out.tong=out.ok.length+' đạt, '+out.loi.length+' lỗi';return out;
}
