export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtCur(n) {
  if (n == null || n === '') return '—';
  return '₹' + parseFloat(n).toFixed(2);
}
export function avatarColor(name) {
  const colors = ['#e8572a','#1db97e','#f4a535','#7b5ea7','#118ab2','#e84a5f'];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}
export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}
