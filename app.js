const API_URL = "https://script.google.com/macros/s/AKfycbz4XhmtWxRYa6HdpxK2O8awkriI7wXPTaBpGNft-HzaQQRkVnXS9Cjpxd3EpqCWu17XsQ/exec";

const HORARIOS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'
];

const DAY_NAMES = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

// ===================== STATE =====================
const state = {
  user: null,
  page: 'home',
  tab: 'dia',
  doctors: [],
  patients: [],
  appts: [],
  selectedHora: '',
  refreshing: false
};

// ===================== UTILS =====================

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatBR(iso) {
  if (!iso || iso === '1899-12-30') return 'Data inválida';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function initials(name) {
  return (name || 'AD').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

function normalizeHora(raw) {
  if (!raw) return '';
  let h = String(raw);
  if (h.includes('T')) h = h.split('T')[1]?.substring(0, 5) || h;
  if (h.includes('1899-12-30')) h = h.replace('1899-12-30', '').trim();
  h = h.replace(/^'/, '');
  return h;
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.querySelector('.toast-msg').textContent = msg;
  el.style.display = 'flex';
  // re-trigger animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 2400);
}

function setButtonsState(disabled) {
  document.querySelectorAll('button.btn').forEach(b => b.disabled = disabled);
}

// ===================== NAVIGATION =====================

function navigate(page) {
  state.page = page;

  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  const target = document.getElementById('page-' + page);
  if (target) {
    target.style.display = 'block';
    target.classList.remove('page-fade');
    void target.offsetWidth;
    target.classList.add('page-fade');
  }

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  renderPage(page);

  const main = document.querySelector('.main');
  if (main) main.scrollTop = 0;
}

function renderPage(page) {
  switch (page) {
    case 'home':         renderHome(); break;
    case 'novo':         renderNovoAgendamento(); break;
    case 'paciente':     renderCadastrarPaciente(); break;
    case 'profissionais': renderProfissionais(); break;
    case 'pacientes':    renderPacientes(); break;
  }
}

// ===================== API =====================

async function apiCall(data) {
  showLoading(true);
  setButtonsState(true);
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    const json = await res.json();
    return json;
  } catch (err) {
    return { success: false, message: 'Erro de conexão: ' + err.message };
  } finally {
    showLoading(false);
    setButtonsState(false);
  }
}

async function carregarMedicos() {
  try {
    const res = await fetch(`${API_URL}?action=listarMedicos`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      state.doctors = json.data.map(m => ({
        id: String(m[0]),
        nome: String(m[1] || ''),
        spec: String(m[2] || '')
      }));
    }
  } catch (e) {
    console.error('Erro ao carregar médicos:', e);
  }
}

async function carregarPacientes() {
  try {
    const res = await fetch(`${API_URL}?action=listarPacientes`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      state.patients = json.data
        .filter(p => p && p[0] && p[1])
        .map(p => ({
          id: String(p[0]),
          nome: String(p[1] || ''),
          cpf: String(p[2] || ''),
          telefone: String(p[3] || ''),
          nascimento: String(p[4] || '')
        }));
    }
  } catch (e) {
    console.error('Erro ao carregar pacientes:', e);
  }
}

async function carregarAgenda() {
  try {
    const res = await fetch(`${API_URL}?action=listarAgendamentos`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      state.appts = json.data.map(a => ({
        id: String(a[0] || ''),
        pacienteId: String(a[1] || ''),
        pacienteNome: String(a[2] || ''),
        medicoId: String(a[3] || ''),
        medicoNome: String(a[4] || ''),
        data: String(a[5] || ''),
        hora: normalizeHora(a[6]),
        status: String(a[7] || 'Agendada')
      })).filter(a => a.id);
    }
  } catch (e) {
    console.error('Erro ao carregar agenda:', e);
  }
}

async function inicializarSistema() {
  showLoading(true);
  await Promise.all([carregarMedicos(), carregarPacientes(), carregarAgenda()]);
  showLoading(false);
  navigate('home');
}

// ===================== LOGIN =====================

async function fazerLogin(e) {
  e.preventDefault();
  const usuario = document.getElementById('login-user').value.trim();
  const senha = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btnLogin = document.getElementById('btn-login');

  errEl.style.display = 'none';

  if (usuario.toLowerCase() !== 'admin') {
    errEl.textContent = 'Palavra-chave inválida.';
    errEl.style.display = 'block';
    return;
  }
  if (!senha) {
    errEl.textContent = 'Preencha a senha para continuar.';
    errEl.style.display = 'block';
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Entrando…';
  showLoading(true);

  try {
    const url = `${API_URL}?action=login&usuario=${encodeURIComponent(usuario)}&senha=${encodeURIComponent(senha)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.success) {
      state.user = json.data?.nome || usuario;
      document.getElementById('screen-login').style.display = 'none';
      document.getElementById('screen-app').style.display = 'grid';
      document.getElementById('sidebar-username').textContent = state.user === 'admin' ? 'Administrador' : state.user;
      document.getElementById('sidebar-avatar').textContent = initials(state.user === 'admin' ? 'Administrador' : state.user);
      await inicializarSistema();
    } else {
      errEl.textContent = json.message || 'Usuário ou senha inválidos.';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Erro ao conectar. Tente novamente.';
    errEl.style.display = 'block';
  } finally {
    showLoading(false);
    btnLogin.disabled = false;
    btnLogin.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Entrar`;
  }
}

function logout() {
  state.user = null;
  state.doctors = [];
  state.patients = [];
  state.appts = [];
  state.selectedHora = '';
  document.getElementById('screen-app').style.display = 'none';
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// ===================== HOME =====================

function renderHome() {
  const today = todayISO();
  const todayAppts = state.appts.filter(a => a.data === today);

  // Header subtitle
  const dt = new Date(today + 'T00:00:00');
  document.getElementById('home-sub').textContent =
    `${DAY_NAMES[dt.getDay()]}, ${dt.getDate()} de ${MONTH_NAMES[dt.getMonth()]} de ${dt.getFullYear()} · ${todayAppts.length} consulta${todayAppts.length !== 1 ? 's' : ''}`;

  // Stats
  const agendadas = todayAppts.filter(a => a.status.toLowerCase() !== 'cancelada').length;
  const canceladas = todayAppts.filter(a => a.status.toLowerCase() === 'cancelada').length;
  const total = todayAppts.length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat">
      <div class="label"><span class="dot dot-sage"></span>Agendadas Hoje</div>
      <div class="value">${agendadas}</div>
      <div class="delta">${Math.round(agendadas / Math.max(total, 1) * 100)}% da agenda</div>
    </div>
    <div class="stat">
      <div class="label"><span class="dot dot-amber"></span>Aguardando confirmação</div>
      <div class="value">0</div>
      <div class="delta">Ligar até às 12h</div>
    </div>
    <div class="stat">
      <div class="label"><span class="dot dot-rose"></span>Canceladas Hoje</div>
      <div class="value">${canceladas}</div>
      <div class="delta">${canceladas} horário${canceladas !== 1 ? 's' : ''} liberado${canceladas !== 1 ? 's' : ''}</div>
    </div>
  `;

  renderAppts();
}

function renderAppts() {
  const today = todayISO();
  let list = state.appts.slice();

  if (state.tab === 'dia') {
    list = list.filter(a => a.data === today);
  }

  list.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

  document.getElementById('tab-dia').classList.toggle('active', state.tab === 'dia');
  document.getElementById('tab-geral').classList.toggle('active', state.tab === 'geral');

  const tbody = document.getElementById('appts-tbody');
  const emptyEl = document.getElementById('appts-empty');
  const tableEl = document.getElementById('appts-table');

  if (list.length === 0) {
    tableEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  tableEl.style.display = 'table';
  emptyEl.style.display = 'none';

  const statusClass = s => {
    if (s.toLowerCase() === 'cancelada') return 'status-cancelada';
    return 'status-agendada';
  };
  const statusLabel = s => {
    if (s.toLowerCase() === 'cancelada') return 'Cancelada';
    return 'Agendada';
  };
  const dotClass = s => s.toLowerCase() === 'cancelada' ? 'dot-rose' : 'dot-sage';

  tbody.innerHTML = list.map(a => {
    const isCancelada = a.status.toLowerCase() === 'cancelada';
    return `
      <tr>
        <td class="date-cell"><span class="d">${formatBR(a.data)}</span></td>
        <td class="time-cell">${a.hora || '—'}</td>
        <td>${escHtml(a.pacienteNome) || '—'}</td>
        <td class="doctor-cell">${escHtml(a.medicoNome) || '—'}</td>
        <td>
          <span class="status ${statusClass(a.status)}">
            <span class="dot ${dotClass(a.status)}"></span>
            ${statusLabel(a.status)}
          </span>
        </td>
        <td>
          ${!isCancelada
            ? `<button class="btn-danger-ghost" onclick="cancelar('${escAttr(a.id)}')">Cancelar</button>`
            : `<span style="color:var(--ink-mute);font-size:12px">—</span>`
          }
        </td>
      </tr>`;
  }).join('');
}

async function cancelar(id) {
  if (!confirm('Deseja realmente cancelar esta consulta?')) return;
  const result = await apiCall({ action: 'cancelarConsulta', id });
  if (result.success) {
    await carregarAgenda();
    renderHome();
    showToast('Consulta cancelada');
  } else {
    alert('Erro ao cancelar: ' + result.message);
  }
}

async function handleRefresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.style.animation = 'spin 0.8s linear infinite';
  await carregarAgenda();
  state.refreshing = false;
  if (icon) icon.style.animation = '';
  renderHome();
  showToast('Agenda atualizada');
}

// ===================== NOVO AGENDAMENTO =====================

function renderNovoAgendamento() {
  // Reset state
  state.selectedHora = '';

  // Reset form
  const form = document.getElementById('form-novo');
  if (form) form.reset();

  // Clear errors
  ['err-paciente','err-medico','err-data','err-hora'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Populate paciente select
  const selPac = document.getElementById('novo-paciente');
  selPac.innerHTML = '<option value="">Selecione um paciente…</option>' +
    state.patients.map(p =>
      `<option value="${escAttr(p.id)}">${escHtml(p.nome)}</option>`
    ).join('');

  // Populate medico select
  const selMed = document.getElementById('novo-medico');
  selMed.innerHTML = '<option value="">Selecione um profissional…</option>' +
    state.doctors.map(d =>
      `<option value="${escAttr(d.id)}">${escHtml(d.nome)} — ${escHtml(d.spec)}</option>`
    ).join('');

  // Set min date
  const today = todayISO();
  const dataInput = document.getElementById('novo-data');
  dataInput.min = today;
  dataInput.value = today;

  renderTimeGrid();
  updateResumo();
}

function renderTimeGrid() {
  const medicoId = document.getElementById('novo-medico')?.value || '';
  const data = document.getElementById('novo-data')?.value || '';

  const busySlots = state.appts
    .filter(a =>
      String(a.medicoId) === String(medicoId) &&
      a.data === data &&
      a.status.toLowerCase() !== 'cancelada'
    )
    .map(a => a.hora);

  const grid = document.getElementById('time-grid');
  if (!grid) return;

  grid.innerHTML = HORARIOS.map(h => {
    const busy = busySlots.includes(h);
    const selected = state.selectedHora === h;
    return `<button type="button" class="slot${selected ? ' selected' : ''}" ${busy ? 'disabled' : ''} onclick="selectHora('${h}')">${h}</button>`;
  }).join('');
}

function selectHora(h) {
  state.selectedHora = h;
  renderTimeGrid();
  updateResumo();
}

function updateResumo() {
  const pacienteId = document.getElementById('novo-paciente')?.value || '';
  const medicoId = document.getElementById('novo-medico')?.value || '';
  const data = document.getElementById('novo-data')?.value || '';

  const paciente = state.patients.find(p => p.id === pacienteId);
  const medico = state.doctors.find(d => d.id === medicoId);

  const row = (label, value, placeholder) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px dashed var(--line)">
      <span style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:0.06em">${label}</span>
      <span style="color:${value ? 'var(--ink)' : 'var(--ink-mute)'};font-weight:${value ? '500' : '400'};text-align:right">${value || placeholder || '—'}</span>
    </div>`;

  const resumo = document.getElementById('novo-resumo');
  if (!resumo) return;

  resumo.innerHTML = [
    row('Paciente', paciente ? escHtml(paciente.nome) : null, 'Não selecionado'),
    row('Profissional', medico ? `${escHtml(medico.nome)} · ${escHtml(medico.spec)}` : null, 'Não selecionado'),
    row('Data', data ? formatBR(data) : null, '—'),
    row('Horário', state.selectedHora || null, '—'),
  ].join('');
}

async function submitAgendamento(e) {
  e.preventDefault();

  const pacienteId = document.getElementById('novo-paciente').value;
  const medicoId = document.getElementById('novo-medico').value;
  const data = document.getElementById('novo-data').value;
  const hora = state.selectedHora;

  // Clear errors
  ['err-paciente','err-medico','err-data','err-hora'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  let hasError = false;
  const setErr = (id, msg) => {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
    hasError = true;
  };

  if (!pacienteId) setErr('err-paciente', 'Selecione um paciente.');
  if (!medicoId)   setErr('err-medico', 'Selecione um médico.');
  if (!data)       setErr('err-data', 'Informe a data.');
  if (!hora)       setErr('err-hora', 'Selecione um horário.');

  if (hasError) return;

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dataSel = new Date(data + 'T00:00:00');
  if (dataSel < hoje) {
    setErr('err-data', 'Não é possível agendar para datas passadas.');
    return;
  }

  const paciente = state.patients.find(p => p.id === pacienteId);

  const result = await apiCall({
    action: 'agendarConsulta',
    pacienteId,
    pacienteNome: paciente?.nome || '',
    medicoId,
    data,
    hora
  });

  if (result.success) {
    await carregarAgenda();
    state.selectedHora = '';
    showToast('Consulta agendada com sucesso');
    navigate('home');
  } else {
    alert('Erro: ' + result.message);
  }
}

// ===================== CADASTRAR PACIENTE =====================

function renderCadastrarPaciente() {
  const form = document.getElementById('form-paciente');
  if (form) form.reset();

  ['err-pac-nome','err-pac-cpf','err-pac-nasc','err-pac-tel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  updateCompletude();
}

function maskCPF(v) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1-$2');
}
function maskPhone(v) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{2})(\d)/,'($1) $2')
    .replace(/(\d{5})(\d)/,'$1-$2');
}
function maskBirth(v) {
  return v.replace(/\D/g,'').slice(0,8)
    .replace(/(\d{2})(\d)/,'$1/$2')
    .replace(/(\d{2})(\d)/,'$1/$2');
}

function updateCompletude() {
  const vals = {
    nome: document.getElementById('pac-nome')?.value?.trim(),
    cpf:  document.getElementById('pac-cpf')?.value?.trim(),
    nasc: document.getElementById('pac-nasc')?.value?.trim(),
    tel:  document.getElementById('pac-tel')?.value?.trim(),
  };
  const filled = Object.values(vals).filter(Boolean).length;
  const pct = Math.round(filled / 4 * 100);

  const pctEl = document.getElementById('completude-pct');
  const barEl = document.getElementById('completude-bar');
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';

  const checkSvg = active =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${active ? 'var(--sage)' : 'var(--line)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="flex-shrink:0;margin-top:2px"><path d="M20 6L9 17l-5-5"/></svg>`;

  const list = document.getElementById('check-list-paciente');
  if (list) {
    list.innerHTML = [
      ['nome', 'Nome completo'],
      ['cpf',  'CPF'],
      ['nasc', 'Data de nascimento'],
      ['tel',  'Telefone'],
    ].map(([k, label]) => `<li>${checkSvg(vals[k])} ${label}</li>`).join('');
  }
}

async function submitPaciente(e) {
  e.preventDefault();

  const nome = document.getElementById('pac-nome').value.trim();
  const cpf  = document.getElementById('pac-cpf').value.trim();
  const nasc = document.getElementById('pac-nasc').value.trim();
  const tel  = document.getElementById('pac-tel').value.trim();

  ['err-pac-nome','err-pac-cpf','err-pac-nasc','err-pac-tel'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  let hasError = false;
  const setErr = (id, msg) => {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
    hasError = true;
  };

  if (!nome) setErr('err-pac-nome', 'Nome é obrigatório.');
  if (!cpf || cpf.replace(/\D/g,'').length !== 11) setErr('err-pac-cpf', 'CPF inválido.');
  if (!nasc) setErr('err-pac-nasc', 'Data de nascimento é obrigatória.');
  if (!tel)  setErr('err-pac-tel', 'Telefone é obrigatório.');

  if (hasError) return;

  // Converter DD/MM/AAAA → AAAA-MM-DD
  let nascFormatado = nasc;
  if (nasc.includes('/')) {
    const parts = nasc.split('/');
    if (parts.length === 3) nascFormatado = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const result = await apiCall({
    action: 'cadastrarPaciente',
    nome, cpf, telefone: tel, nascimento: nascFormatado
  });

  if (result.success) {
    await carregarPacientes();
    showToast('Paciente cadastrado com sucesso');
    navigate('home');
  } else {
    alert('Erro: ' + result.message);
  }
}

// ===================== PROFISSIONAIS =====================

function renderProfissionais() {
  const n = state.doctors.length;
  document.getElementById('prof-sub').textContent =
    `${n} profissional${n !== 1 ? 'is' : ''} cadastrado${n !== 1 ? 's' : ''} na clínica.`;
  document.getElementById('prof-meta').textContent =
    `${n} profissional${n !== 1 ? 'is' : ''}`;

  const tbody = document.getElementById('prof-tbody');
  const emptyEl = document.getElementById('prof-empty');

  if (!state.doctors.length) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  tbody.innerHTML = state.doctors.map(d => `
    <tr>
      <td>${escHtml(d.nome)}</td>
      <td style="color:var(--ink-soft)">${escHtml(d.spec)}</td>
    </tr>`).join('');
}

// ===================== PACIENTES =====================

function renderPacientes() {
  const n = state.patients.length;
  document.getElementById('pacs-sub').textContent =
    `${n} paciente${n !== 1 ? 's' : ''} cadastrado${n !== 1 ? 's' : ''} na clínica.`;
  document.getElementById('pacs-meta').textContent =
    `${n} paciente${n !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('pacs-tbody');
  const emptyEl = document.getElementById('pacs-empty');

  if (!state.patients.length) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  tbody.innerHTML = state.patients.map(p => `
    <tr>
      <td>${escHtml(p.nome)}</td>
      <td class="time-cell" style="color:var(--ink-soft)">${escHtml(p.cpf)}</td>
    </tr>`).join('');
}

// ===================== SECURITY HELPERS =====================

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str || '').replace(/'/g,"\\'");
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', () => {

  // Login form
  document.getElementById('form-login').addEventListener('submit', fazerLogin);

  // Toggle password visibility
  document.getElementById('toggle-pwd').addEventListener('click', () => {
    const input = document.getElementById('login-pass');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Navigation: all [data-page] buttons
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  // Tabs
  document.getElementById('tab-dia').addEventListener('click', () => {
    state.tab = 'dia';
    renderAppts();
  });
  document.getElementById('tab-geral').addEventListener('click', () => {
    state.tab = 'geral';
    renderAppts();
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', handleRefresh);

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Novo agendamento form
  document.getElementById('form-novo').addEventListener('submit', submitAgendamento);

  document.getElementById('novo-medico').addEventListener('change', () => {
    renderTimeGrid();
    updateResumo();
  });
  document.getElementById('novo-data').addEventListener('change', () => {
    renderTimeGrid();
    updateResumo();
  });
  document.getElementById('novo-paciente').addEventListener('change', updateResumo);

  document.getElementById('link-cad-paciente').addEventListener('click', e => {
    e.preventDefault();
    navigate('paciente');
  });

  // Paciente form
  document.getElementById('form-paciente').addEventListener('submit', submitPaciente);
  document.getElementById('pac-cpf').addEventListener('input', e => {
    e.target.value = maskCPF(e.target.value);
    updateCompletude();
  });
  document.getElementById('pac-tel').addEventListener('input', e => {
    e.target.value = maskPhone(e.target.value);
    updateCompletude();
  });
  document.getElementById('pac-nasc').addEventListener('input', e => {
    e.target.value = maskBirth(e.target.value);
    updateCompletude();
  });
  document.getElementById('pac-nome').addEventListener('input', updateCompletude);

  // Initial render of completude checklist
  updateCompletude();
});
