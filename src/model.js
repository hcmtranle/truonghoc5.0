/* Shared validation and import logic. No network or storage side effects. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchoolModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const headers = ['Họ và tên','Email','Số điện thoại','Chức danh','Lớp dạy'];
  const roles = ['Tổ trưởng','Tổ phó','Tổ viên'];
  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  function validateMember(input) {
    const value = Object.fromEntries(['name','email','phone','role','className'].map(k => [k,String(input[k] || '').trim()]));
    value.email = normalizeEmail(value.email);
    const errors = [];
    if (!value.name || value.name.length > 100) errors.push('Họ và tên phải có từ 1 đến 100 ký tự');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 254) errors.push('Email không hợp lệ');
    if (value.phone && !/^\+?[\d ()-]{8,20}$/.test(value.phone)) errors.push('Số điện thoại không hợp lệ');
    if (!roles.includes(value.role)) errors.push('Chức danh phải là Tổ trưởng, Tổ phó hoặc Tổ viên');
    if (value.className.length > 80) errors.push('Lớp dạy tối đa 80 ký tự');
    return {value,errors};
  }
  function previewImport(matrix, existing) {
    if (!Array.isArray(matrix) || !matrix.length) throw new Error('File chưa có dữ liệu.');
    const first = matrix[0].map(v => String(v || '').trim());
    const missing = headers.filter(h => !first.includes(h));
    if (missing.length) throw new Error('Thiếu cột: ' + missing.join(', '));
    if (headers.some(h => first.filter(v => v === h).length !== 1)) throw new Error('File có tên cột bị trùng.');
    if (matrix.length > 501) throw new Error('Mỗi lần nhập tối đa 500 dòng. Vui lòng chia nhỏ file.');
    const seen = new Set(), emails = new Set(existing.map(m => normalizeEmail(m.email)));
    return matrix.slice(1).map((row, i) => {
      if (row.every(v => !String(v ?? '').trim())) return null;
      const data = Object.fromEntries(['name','email','phone','role','className'].map((k,n) => [k,row[first.indexOf(headers[n])]]));
      const {value, errors} = validateMember(data);
      if (seen.has(value.email)) errors.push('Email trùng trong file');
      seen.add(value.email);
      return {line:i+2, value, errors, duplicate:emails.has(value.email)};
    }).filter(Boolean);
  }
  function mergeImport(existing, rows, mode, makeId) {
    if (!['skip','update'].includes(mode)) throw new Error('Cách xử lý trùng không hợp lệ.');
    if (!rows.length || rows.some(r => r.errors.length)) throw new Error('Cần sửa hết lỗi trước khi nhập.');
    const next = existing.map(m => ({...m}));
    let added = 0, updated = 0, skipped = 0;
    rows.forEach(({value}) => {
      const index = next.findIndex(m => normalizeEmail(m.email) === value.email);
      if (index >= 0) {
        if (mode === 'update') { next[index] = {...next[index],...value}; updated++; }
        else skipped++;
      } else { next.push({...value,id:makeId(),photo:''}); added++; }
    });
    return {members:next,added,updated,skipped};
  }
  return {headers,roles,normalizeEmail,validateMember,previewImport,mergeImport};
});
